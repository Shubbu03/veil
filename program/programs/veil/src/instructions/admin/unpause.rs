use crate::error::VeilProgramError;
use crate::events::ProgramUnpaused;
use crate::VeilConfig;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct Unpause<'info> {
    #[account(
        mut,
        seeds = [b"veil_config"],
        bump
    )]
    pub config: Account<'info, VeilConfig>,

    pub governance: Signer<'info>,
}

impl<'info> Unpause<'info> {
    pub fn unpause(&mut self) -> Result<()> {
        require!(
            self.governance.key() == self.config.governance,
            VeilProgramError::Unauthorized
        );
        require!(self.config.paused, VeilProgramError::NotPaused);

        self.config.paused = false;

        emit!(ProgramUnpaused {
            governance: self.governance.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}
