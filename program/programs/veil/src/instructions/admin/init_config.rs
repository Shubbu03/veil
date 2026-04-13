use anchor_lang::prelude::*;

use crate::error::VeilProgramError;
use crate::events::ConfigInitialized;
use crate::{validate_mint_whitelist, VeilConfig, ANCHOR_DISCRIMINATOR};

#[derive(Accounts)]
pub struct InitConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = ANCHOR_DISCRIMINATOR + VeilConfig::INIT_SPACE,
        seeds = [b"veil_config"],
        bump
    )]
    pub config: Account<'info, VeilConfig>,

    pub system_program: Program<'info, System>,
}

impl<'info> InitConfig<'info> {
    pub fn init_config(
        &mut self,
        governance: Pubkey,
        er_authority: Pubkey,
        allowed_mints: Vec<Pubkey>,
        whitelist_enabled: bool,
        max_recipients: u16,
        batch_timeout_secs: u64,
    ) -> Result<()> {
        require!(max_recipients > 0, VeilProgramError::InvalidMaxRecipients);
        require!(
            er_authority != Pubkey::default(),
            VeilProgramError::InvalidErAuthority
        );
        validate_mint_whitelist(&allowed_mints, whitelist_enabled)?;

        // Validate batch timeout: 1 hour (3600) to 30 days (2592000)
        const MIN_TIMEOUT: u64 = 3600; // 1 hour
        const MAX_TIMEOUT: u64 = 2592000; // 30 days
        require!(
            batch_timeout_secs >= MIN_TIMEOUT && batch_timeout_secs <= MAX_TIMEOUT,
            VeilProgramError::InvalidBatchTimeout
        );

        self.config.set_inner(VeilConfig {
            governance,
            er_authority,
            whitelist_enabled,
            allowed_mints: allowed_mints.clone(),
            max_recipients,
            paused: false,
            batch_timeout_secs,
        });

        emit!(ConfigInitialized {
            governance,
            er_authority,
            whitelist_enabled,
            allowed_mints,
            max_recipients,
            batch_timeout_secs,
        });

        Ok(())
    }
}
