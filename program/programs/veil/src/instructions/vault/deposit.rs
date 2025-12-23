use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::error::VeilProgramError;
use crate::events::VaultDeposited;
use crate::{VaultAccount, VeilConfig};

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub employer: Signer<'info>,

    #[account(
        seeds = [b"veil_config"],
        bump
    )]
    pub config: Account<'info, VeilConfig>,

    #[account(
        mut,
        seeds = [b"vault", employer.key().as_ref()],
        bump = vault.bump,
        has_one = employer @ VeilProgramError::Unauthorized,
        has_one = token_mint @ VeilProgramError::InvalidMint,
    )]
    pub vault: Account<'info, VaultAccount>,

    #[account(
        mut,
        address = vault.vault_ata @ VeilProgramError::InvalidTokenAccount
    )]
    pub vault_ata: Account<'info, TokenAccount>,

    #[account(mut)]
    pub employer_ata: Account<'info, TokenAccount>,

    pub token_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
}

impl<'info> Deposit<'info> {
    pub fn deposit_to_vault(&mut self, amount: u64) -> Result<()> {
        require!(!self.config.paused, VeilProgramError::Paused);
        require!(
            self.token_mint.key() == self.config.allowed_mint,
            VeilProgramError::InvalidMint
        );
        require!(
            self.employer_ata.owner == self.employer.key(),
            VeilProgramError::Unauthorized
        );
        require!(
            self.employer_ata.mint == self.token_mint.key(),
            VeilProgramError::InvalidMint
        );
        require!(amount > 0, VeilProgramError::InsufficientFunds);

        // Transfer tokens from employer to vault
        let cpi_accounts = Transfer {
            from: self.employer_ata.to_account_info(),
            to: self.vault_ata.to_account_info(),
            authority: self.employer.to_account_info(),
        };
        let cpi_program = self.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount)?;

        // Update vault state
        self.vault.available = self
            .vault
            .available
            .checked_add(amount)
            .ok_or(VeilProgramError::InsufficientFunds)?;

        // Verify invariant: available + reserved == balance
        let balance = self.vault_ata.amount;
        require!(
            self.vault
                .available
                .checked_add(self.vault.reserved)
                .ok_or(VeilProgramError::InsufficientFunds)?
                == balance,
            VeilProgramError::VaultMismatch
        );

        emit!(VaultDeposited {
            vault: self.vault.key(),
            employer: self.employer.key(),
            amount,
            available: self.vault.available,
        });

        Ok(())
    }
}
