use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct CreateSchedule<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> CreateSchedule<'info> {
    pub fn create_scehdule(&mut self) -> Result<()> {
        Ok(())
    }
}
