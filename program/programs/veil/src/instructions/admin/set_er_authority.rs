use crate::error::VeilProgramError;
use crate::events::ErAuthorityUpdated;
use crate::VeilConfig;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct SetErAuthority<'info> {
    #[account(
        mut,
        seeds = [b"veil_config"],
        bump
    )]
    pub config: Account<'info, VeilConfig>,

    pub governance: Signer<'info>,
}

impl<'info> SetErAuthority<'info> {
    pub fn set_er_auth(&mut self, new_er_authority: Pubkey) -> Result<()> {
        require!(
            self.governance.key() == self.config.governance,
            VeilProgramError::Unauthorized
        );
        require!(!self.config.paused, VeilProgramError::Paused);
        require!(
            new_er_authority != Pubkey::default(),
            VeilProgramError::InvalidErAuthority
        );

        let old_er_authority = self.config.er_authority;
        self.config.er_authority = new_er_authority;

        emit!(ErAuthorityUpdated {
            governance: self.governance.key(),
            old_er_authority,
            new_er_authority,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}
