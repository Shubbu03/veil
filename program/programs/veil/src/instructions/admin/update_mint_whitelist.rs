use anchor_lang::prelude::*;

use crate::error::VeilProgramError;
use crate::events::MintWhitelistUpdated;
use crate::{validate_mint_whitelist, VeilConfig};

#[derive(Accounts)]
pub struct UpdateMintWhitelist<'info> {
    #[account(mut)]
    pub governance: Signer<'info>,

    #[account(
        mut,
        seeds = [b"veil_config"],
        bump
    )]
    pub config: Account<'info, VeilConfig>,
}

impl<'info> UpdateMintWhitelist<'info> {
    pub fn update_mint_whitelist(
        &mut self,
        whitelist_enabled: bool,
        allowed_mints: Vec<Pubkey>,
    ) -> Result<()> {
        require!(
            self.governance.key() == self.config.governance,
            VeilProgramError::Unauthorized
        );
        validate_mint_whitelist(&allowed_mints, whitelist_enabled)?;

        self.config.whitelist_enabled = whitelist_enabled;
        self.config.allowed_mints = allowed_mints.clone();

        emit!(MintWhitelistUpdated {
            governance: self.governance.key(),
            whitelist_enabled,
            allowed_mints,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}
