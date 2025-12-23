use anchor_lang::prelude::*;

use crate::error::VeilProgramError;
use crate::events::ConfigInitialized;
use crate::{VeilConfig, ANCHOR_DISCRIMINATOR};

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
        allowed_mint: Pubkey,
        max_recipients: u16,
    ) -> Result<()> {
        require!(max_recipients > 0, VeilProgramError::InvalidMaxRecipients);
        require!(
            er_authority != Pubkey::default(),
            VeilProgramError::InvalidErAuthority
        );
        require!(
            allowed_mint != Pubkey::default(),
            VeilProgramError::InvalidErAuthority
        );

        self.config.set_inner(VeilConfig {
            governance,
            er_authority,
            allowed_mint,
            max_recipients,
            paused: false,
        });

        emit!(ConfigInitialized {
            governance,
            er_authority,
            allowed_mint,
            max_recipients,
        });

        Ok(())
    }
}
