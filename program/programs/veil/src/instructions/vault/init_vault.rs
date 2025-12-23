use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::error::VeilProgramError;
use crate::events::VaultInitialized;
use crate::{VeilConfig, VaultAccount, ANCHOR_DISCRIMINATOR};

#[derive(Accounts)]
pub struct InitVault<'info> {
    #[account(mut)]
    pub employer: Signer<'info>,

    #[account(
        seeds = [b"veil_config"],
        bump
    )]
    pub config: Account<'info, VeilConfig>,

    pub token_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = employer,
        space = ANCHOR_DISCRIMINATOR + VaultAccount::INIT_SPACE,
        seeds = [b"vault", employer.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, VaultAccount>,

    #[account(
        init,
        payer = employer,
        token::mint = token_mint,
        token::authority = vault,
        seeds = [b"vault_ata", vault.key().as_ref()],
        bump
    )]
    pub vault_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl<'info> InitVault<'info> {
    pub fn init_vault(&mut self) -> Result<()> {
        require!(!self.config.paused, VeilProgramError::Paused);
        require!(
            self.token_mint.key() == self.config.allowed_mint,
            VeilProgramError::InvalidMint
        );

        // Derive bump from seeds - Anchor validates this matches
        let employer_key = self.employer.key();
        let program_id = self.vault.to_account_info().owner;
        let seeds = &[b"vault", employer_key.as_ref()];
        let (vault_pda, bump) = Pubkey::find_program_address(seeds, program_id);
        require!(
            vault_pda == self.vault.key(),
            VeilProgramError::VaultMismatch
        );
        
        self.vault.set_inner(VaultAccount {
            employer: self.employer.key(),
            vault_ata: self.vault_ata.key(),
            token_mint: self.token_mint.key(),
            available: 0,
            reserved: 0,
            bump,
        });

        emit!(VaultInitialized {
            employer: self.employer.key(),
            vault: self.vault.key(),
            vault_ata: self.vault_ata.key(),
            token_mint: self.token_mint.key(),
        });

        Ok(())
    }
}
