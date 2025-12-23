use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::delegate;
use ephemeral_rollups_sdk::cpi::DelegateConfig;

use crate::error::VeilProgramError;
use crate::events::VaultDelegated;
use crate::{VaultAccount, VeilConfig};

#[delegate]
#[derive(Accounts)]
pub struct DelegateVault<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

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

    /// CHECK: The vault PDA to delegate
    #[account(mut, del)]
    pub pda: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> DelegateVault<'info> {
    pub fn delegate_vault(&mut self) -> Result<()> {
        require!(!self.config.paused, VeilProgramError::Paused);
        require!(
            self.pda.key() == self.vault.key(),
            VeilProgramError::VaultMismatch
        );
        
        let employer_key = self.vault.employer;
        let bump = self.vault.bump;
        let seeds = &[b"vault", employer_key.as_ref(), &[bump]];

        // Delegate the vault PDA to ER using SDK's delegate_pda method
        // delegate_pda(payer, seeds, config)
        let config = DelegateConfig {
            validator: None,        // Use default validator
            commit_frequency_ms: 0, // Use default
        };
        self.delegate_pda(&self.payer, seeds, config)?;

        emit!(VaultDelegated {
            vault: self.vault.key(),
            er_authority: self.config.er_authority,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}
