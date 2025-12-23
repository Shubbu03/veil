use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::cpi::undelegate_account;

use crate::error::VeilProgramError;
use crate::events::VaultUndelegated;
use crate::{VaultAccount, VeilConfig};

#[derive(Accounts)]
pub struct UndelegateVault<'info> {
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

    /// CHECK: The vault PDA to undelegate
    #[account(mut)]
    pub pda: AccountInfo<'info>,

    /// CHECK: Undelegate buffer PDA
    #[account(mut)]
    pub buffer: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> UndelegateVault<'info> {
    pub fn undelegate_vault(&mut self) -> Result<()> {
        require!(!self.config.paused, VeilProgramError::Paused);
        require!(
            self.pda.key() == self.vault.key(),
            VeilProgramError::VaultMismatch
        );

        // Prepare seeds for the vault PDA
        let employer_key = self.vault.employer;
        let bump = self.vault.bump;
        let seeds = vec![
            b"vault".to_vec(),
            employer_key.as_ref().to_vec(),
            vec![bump],
        ];

        // Undelegate the vault PDA from ER using SDK's CPI function
        undelegate_account(
            &self.pda.to_account_info(),
            &crate::ID,
            &self.buffer.to_account_info(),
            &self.payer.to_account_info(),
            &self.system_program.to_account_info(),
            seeds,
        )?;

        emit!(VaultUndelegated {
            vault: self.vault.key(),
            er_authority: self.config.er_authority,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}
