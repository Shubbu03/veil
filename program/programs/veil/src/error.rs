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

    #[msg("Schedule is not active")]
    ScheduleNotActive,

    #[msg("Schedule is already cancelled")]
    ScheduleAlreadyCancelled,

    #[msg("Schedule is already paused")]
    ScheduleAlreadyPaused,

    #[msg("Schedule is not paused")]
    ScheduleNotPaused,

    #[msg("Schedule has an in-progress payout batch")]
    ScheduleBatchInProgress,

    #[msg("Invalid schedule ID")]
    InvalidScheduleId,

    #[msg("Invalid schedule interval")]
    InvalidScheduleInterval,

    #[msg("Invalid reserved amount")]
    InvalidReservedAmount,

    #[msg("Invalid per-execution amount")]
    InvalidPerExecutionAmount,

    #[msg("Invalid recipients hash")]
    InvalidRecipientsHash,

    #[msg("Invalid amounts hash")]
    InvalidAmountsHash,

    #[msg("Execution too early - next execution time not reached")]
    ExecutionTooEarly,

    #[msg("Replay detected - batch ID must be greater than last executed")]
    ReplayDetected,

    #[msg("Recipient count mismatch")]
    RecipientCountMismatch,

    #[msg("Invalid Merkle proof")]
    InvalidMerkleProof,

    #[msg("Recipient already paid")]
    AlreadyPaid,

    #[msg("Invalid leaf index")]
    InvalidLeafIndex,

    #[msg("Invalid batch timeout - must be between 1 hour and 30 days")]
    InvalidBatchTimeout,

    #[msg("Invalid mint whitelist configuration")]
    InvalidMintWhitelist,

    #[msg("Too many allowed mints configured")]
    TooManyAllowedMints,

    #[msg("Duplicate mint found in whitelist")]
    DuplicateAllowedMint,
}
