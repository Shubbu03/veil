use anchor_lang::prelude::*;

#[error_code]
pub enum VeilProgramError {
    #[msg("Unauthorized: caller is not governance")]
    Unauthorized,

    #[msg("Program is paused")]
    Paused,

    #[msg("Program is not paused")]
    NotPaused,

    #[msg("Invalid ER authority")]
    InvalidErAuthority,

    #[msg("Max recipients must be greater than 0")]
    InvalidMaxRecipients,

    #[msg("Insufficient available funds")]
    InsufficientFunds,

    #[msg("Invalid token mint")]
    InvalidMint,

    #[msg("Vault account mismatch")]
    VaultMismatch,

    #[msg("Invalid token account")]
    InvalidTokenAccount,

    #[msg("Vault already initialized")]
    VaultAlreadyInitialized,
}
