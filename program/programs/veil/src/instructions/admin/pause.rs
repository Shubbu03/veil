use crate::error::VeilProgramError;
use crate::events::ProgramPaused;
use crate::VeilConfig;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct Pause<'info> {
    #[account(
        mut,
        seeds = [b"veil_config"],
        bump
    )]
    pub config: Account<'info, VeilConfig>,

    pub governance: Signer<'info>,
}

impl<'info> Pause<'info> {
    pub fn pause(&mut self) -> Result<()> {
        require!(
            self.governance.key() == self.config.governance,
            VeilProgramError::Unauthorized
        );
        require!(!self.config.paused, VeilProgramError::Paused);

        self.config.paused = true;

        emit!(ProgramPaused {
            governance: self.governance.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}
