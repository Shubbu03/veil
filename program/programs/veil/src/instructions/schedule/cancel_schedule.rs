use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct CancelSchedule<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> CancelSchedule<'info> {
    pub fn cancel_schedule(&mut self) -> Result<()> {
        Ok(())
    }
}
