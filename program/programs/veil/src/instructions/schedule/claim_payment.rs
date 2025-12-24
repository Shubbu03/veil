use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::error::VeilProgramError;
use crate::events::PaymentClaimed;
use crate::state::ScheduleStatus;
use crate::utils::merkle::{hash_leaf, verify_merkle_proof};
use crate::{ScheduleAccount, VaultAccount, VeilConfig};

#[derive(Accounts)]
#[instruction(
    schedule_id: [u8; 32],
    recipient: Pubkey,
    amount: u64,
    leaf_index: u16,
)]
pub struct ClaimPayment<'info> {
    /// CHECK: ER authority signer
    pub er_authority: Signer<'info>,

    #[account(
        seeds = [b"veil_config"],
        bump
    )]
    pub config: Account<'info, VeilConfig>,

    #[account(
        mut,
        seeds = [b"vault", vault.employer.as_ref()],
        bump = vault.bump,
    )]
    pub vault: Account<'info, VaultAccount>,

    #[account(
        mut,
        address = vault.vault_ata @ VeilProgramError::InvalidTokenAccount
    )]
    pub vault_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"schedule", schedule.vault.as_ref(), schedule_id.as_ref()],
        bump = schedule.bump,
    )]
    pub schedule: Account<'info, ScheduleAccount>,

    #[account(mut)]
    pub recipient_ata: Account<'info, TokenAccount>,

    pub token_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
}

impl<'info> ClaimPayment<'info> {
    pub fn claim_payment(
        &mut self,
        _schedule_id: [u8; 32],
        recipient: Pubkey,
        amount: u64,
        leaf_index: u16,
        proof: Vec<[u8; 32]>,
    ) -> Result<()> {
        // Verify ER authority
        require!(
            self.er_authority.key() == self.config.er_authority,
            VeilProgramError::Unauthorized
        );

        // Verify schedule status
        require!(
            self.schedule.status == ScheduleStatus::Active,
            VeilProgramError::ScheduleNotActive
        );

        // Verify timing
        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp as u64 >= self.schedule.next_execution,
            VeilProgramError::ExecutionTooEarly
        );

        // Verify leaf index is valid
        require!(
            leaf_index < self.schedule.total_recipients,
            VeilProgramError::InvalidLeafIndex
        );

        // Verify recipient ATA matches
        require!(
            self.recipient_ata.owner == recipient,
            VeilProgramError::Unauthorized
        );
        require!(
            self.recipient_ata.mint == self.token_mint.key(),
            VeilProgramError::InvalidMint
        );

        // Verify Merkle proof
        let leaf = hash_leaf(&recipient, amount);
        require!(
            verify_merkle_proof(leaf, &proof, leaf_index, self.schedule.merkle_root),
            VeilProgramError::InvalidMerkleProof
        );

        // Check if already paid using bitmap
        let byte_index = (leaf_index / 8) as usize;
        let bit_index = (leaf_index % 8) as u8;
        require!(
            byte_index < self.schedule.paid_bitmap.len(),
            VeilProgramError::InvalidLeafIndex
        );
        let is_paid = (self.schedule.paid_bitmap[byte_index] >> bit_index) & 1 == 1;
        require!(!is_paid, VeilProgramError::AlreadyPaid);

        // Verify amount doesn't exceed per_execution_amount
        require!(
            amount > 0 && amount <= self.schedule.per_execution_amount,
            VeilProgramError::InsufficientFunds
        );

        // Transfer tokens from vault_ata to recipient_ata
        // Use vault PDA as signer
        let employer_key = self.vault.employer;
        let bump = self.vault.bump;
        let seeds = &[b"vault", employer_key.as_ref(), &[bump]];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: self.vault_ata.to_account_info(),
            to: self.recipient_ata.to_account_info(),
            authority: self.vault.to_account_info(),
        };
        let cpi_program = self.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_ctx, amount)?;

        // Mark as paid in bitmap
        self.schedule.paid_bitmap[byte_index] |= 1 << bit_index;

        // Update schedule state
        self.schedule.paid_count = self
            .schedule
            .paid_count
            .checked_add(1)
            .ok_or(VeilProgramError::InsufficientFunds)?;

        // If all recipients paid, reset for next interval
        if self.schedule.paid_count >= self.schedule.total_recipients {
            // Deduct per_execution_amount from reserved
            self.schedule.reserved_amount = self
                .schedule
                .reserved_amount
                .checked_sub(self.schedule.per_execution_amount)
                .ok_or(VeilProgramError::InsufficientFunds)?;

            // Update vault reserved amount
            self.vault.reserved = self
                .vault
                .reserved
                .checked_sub(self.schedule.per_execution_amount)
                .ok_or(VeilProgramError::InsufficientFunds)?;

            // Reset paid_count, bitmap, and advance next_execution
            self.schedule.paid_count = 0;
            self.schedule.paid_bitmap = [0u8; 128]; // Clear bitmap
            self.schedule.next_execution = clock.unix_timestamp as u64 + self.schedule.interval_secs;
            self.schedule.last_executed_batch = self
                .schedule
                .last_executed_batch
                .checked_add(1)
                .ok_or(VeilProgramError::InsufficientFunds)?;
        }

        emit!(PaymentClaimed {
            schedule: self.schedule.key(),
            recipient,
            amount,
            leaf_index,
            paid_count: self.schedule.paid_count,
        });

        Ok(())
    }
}

