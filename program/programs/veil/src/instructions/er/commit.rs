use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::commit;
use ephemeral_rollups_sdk::ephem::commit_accounts;

use crate::error::VeilProgramError;
use crate::events::StateCommitted;
use crate::VeilConfig;

#[commit]
#[derive(Accounts)]
pub struct Commit<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        seeds = [b"veil_config"],
        bump
    )]
    pub config: Account<'info, VeilConfig>,

    /// CHECK: The delegated account to commit (vault or schedule PDA)
    #[account(mut)]
    pub delegated_account: AccountInfo<'info>,
}

impl<'info> Commit<'info> {
    pub fn commit(&self) -> Result<()> {
        require!(!self.config.paused, VeilProgramError::Paused);

        commit_accounts(
            &self.payer.to_account_info(),
            vec![&self.delegated_account],
            &self.magic_context,
            &self.magic_program,
        )
        .map_err(|_| VeilProgramError::Unauthorized)?;

        emit!(StateCommitted {
            account: self.delegated_account.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}
