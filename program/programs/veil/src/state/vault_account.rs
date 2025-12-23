use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct VaultAccount {
   pub employer: Pubkey,
   pub vault_ata: Pubkey,  // PDA token account
   pub token_mint: Pubkey, // USDC
   pub available: u64,     // free funds
   pub reserved: u64,      // locked funds
   pub bump: u8,
}
