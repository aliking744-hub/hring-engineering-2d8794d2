from __future__ import annotations

from pydantic import BaseModel, Field


class TaxBracket(BaseModel):
    upper_bound_rial: int | None
    rate: float


class StatutoryRatesResponse(BaseModel):
    year: int
    housing_allowance_rial: int
    grocery_allowance_rial: int
    tax_brackets: list[TaxBracket]
    sources: list[str]


class EmployeeCostCalculationRequest(BaseModel):
    is_net_contract: bool = False
    base_salary: float = Field(ge=0)
    job_absorption: float = Field(default=0, ge=0)
    responsibility_allowance: float = Field(default=0, ge=0)
    job_superlative: float = Field(default=0, ge=0)
    children_allowance: float = Field(default=0, ge=0)
    other_benefits: float = Field(default=0, ge=0)
    overtime_base_hours: float = Field(default=176, gt=0, le=744)
    overtime_hours: float = Field(default=0, ge=0, le=744)
    monthly_performance: float = Field(default=0, ge=0)
    monthly_bonus: float = Field(default=0, ge=0)
    supplementary_insurance: float = Field(default=0, ge=0)
    annual_occasional_benefits: float = Field(default=0, ge=0)
    recruitment_cost: float = Field(default=0, ge=0)
    training_cost: float = Field(default=0, ge=0)
    misc_cost: float = Field(default=0, ge=0)


class EmployeeCostCalculationResponse(BaseModel):
    statutory_year: int
    housing_allowance: float
    grocery_allowance: float
    effective_base: float
    insurable_gross: float
    total_gross: float
    overtime_pay: float
    variable_pay: float
    monthly_occasional_benefits: float
    employer_insurance: float
    employer_income_tax: float
    income_tax: float
    severance_accrual: float
    eidi_accrual: float
    leave_redemption: float
    total_statutory: float
    total_welfare: float
    total_hidden_hr: float
    total_monthly_cost: float
    net_salary: float
    multiplier: float
    is_net_contract: bool
