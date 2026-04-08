use anchor_lang::prelude::*;

use crate::error::VeilProgramError;
use crate::MAX_ALLOWED_MINTS;

#[account]
#[derive(InitSpace)]
pub struct VeilConfig {
    pub er_authority: Pubkey, // ER signer
    pub governance: Pubkey,   // admin multisig
    pub paused: bool,         // emergency flag
    pub whitelist_enabled: bool,
    pub max_recipients: u16,
    #[max_len(16)]
    pub allowed_mints: Vec<Pubkey>,
    pub batch_timeout_secs: u64, // Global timeout for batch completion (seconds)
}

impl VeilConfig {
    pub fn is_mint_allowed(&self, mint: &Pubkey) -> bool {
        !self.whitelist_enabled || self.allowed_mints.iter().any(|allowed| allowed == mint)
    }
}

pub fn validate_mint_whitelist(allowed_mints: &[Pubkey], whitelist_enabled: bool) -> Result<()> {
    require!(
        allowed_mints.len() <= MAX_ALLOWED_MINTS,
        VeilProgramError::TooManyAllowedMints
    );

    if whitelist_enabled {
        require!(
            !allowed_mints.is_empty(),
            VeilProgramError::InvalidMintWhitelist
        );
    }

    for (index, mint) in allowed_mints.iter().enumerate() {
        require!(*mint != Pubkey::default(), VeilProgramError::InvalidMintWhitelist);

        let has_duplicate = allowed_mints
            .iter()
            .skip(index + 1)
            .any(|other_mint| other_mint == mint);
        require!(!has_duplicate, VeilProgramError::DuplicateAllowedMint);
    }

    Ok(())
}
