use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct ExecuteSettlement<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> ExecuteSettlement<'info> {
    pub fn execute_settlement(&mut self) -> Result<()> {
        Ok(())
    }
}
