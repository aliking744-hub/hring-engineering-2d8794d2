from __future__ import annotations

from dataclasses import dataclass

from hring_api.domains.costing.schemas import (
    EmployeeCostCalculationRequest,
    EmployeeCostCalculationResponse,
    StatutoryRatesResponse,
    TaxBracket,
)


@dataclass(frozen=True)
class StatutoryRateCard:
    year: int
    housing_allowance_rial: int
    grocery_allowance_rial: int
    tax_brackets: tuple[tuple[int | None, float], ...]
    sources: tuple[str, ...]


# Central, versioned statutory configuration. Product UI never hard-codes annual law rates.
_RATE_CARDS: dict[int, StatutoryRateCard] = {
    1404: StatutoryRateCard(
        year=1404,
        housing_allowance_rial=9_000_000,
        grocery_allowance_rial=22_000_000,
        tax_brackets=(
            (2_880_000_000, 0.0),
            (3_600_000_000, 0.10),
            (4_560_000_000, 0.15),
            (6_000_000_000, 0.20),
            (8_000_000_000, 0.25),
            (None, 0.30),
        ),
        sources=("قانون بودجه سال ۱۴۰۴",),
    ),
    1405: StatutoryRateCard(
        year=1405,
        housing_allowance_rial=30_000_000,
        grocery_allowance_rial=22_000_000,
        tax_brackets=(
            (4_800_000_000, 0.0),
            (9_600_000_000, 0.10),
            (12_000_000_000, 0.15),
            (14_400_000_000, 0.20),
            (16_800_000_000, 0.25),
            (None, 0.30),
        ),
        sources=(
            "https://dotic.ir/news/20433",
            "مصوبه حداقل مزد شورای عالی کار سال ۱۴۰۵",
            "قانون بودجه سال ۱۴۰۵",
        ),
    ),
}
CURRENT_STATUTORY_YEAR = max(_RATE_CARDS)


def current_rate_card() -> StatutoryRateCard:
    return _RATE_CARDS[CURRENT_STATUTORY_YEAR]


def current_rates_response() -> StatutoryRatesResponse:
    card = current_rate_card()
    return StatutoryRatesResponse(
        year=card.year,
        housing_allowance_rial=card.housing_allowance_rial,
        grocery_allowance_rial=card.grocery_allowance_rial,
        tax_brackets=[
            TaxBracket(upper_bound_rial=upper_bound, rate=rate)
            for upper_bound, rate in card.tax_brackets
        ],
        sources=list(card.sources),
    )


def _annual_income_tax(monthly_taxable_income: float, card: StatutoryRateCard) -> float:
    annual_income = max(0.0, monthly_taxable_income) * 12
    tax = 0.0
    lower_bound = 0.0
    for upper_bound, rate in card.tax_brackets:
        if annual_income <= lower_bound:
            break
        taxable_slice = (
            annual_income - lower_bound
            if upper_bound is None
            else min(annual_income, float(upper_bound)) - lower_bound
        )
        if taxable_slice > 0:
            tax += taxable_slice * rate
        if upper_bound is None or annual_income <= upper_bound:
            break
        lower_bound = float(upper_bound)
    return tax


def _monthly_income_tax(monthly_taxable_income: float, card: StatutoryRateCard) -> float:
    return _annual_income_tax(monthly_taxable_income, card) / 12


def _gross_up_from_net(net_salary: float, card: StatutoryRateCard) -> float:
    gross = net_salary / 0.93 if net_salary else 0.0
    for _ in range(16):
        insurance = gross * 0.07
        tax = _monthly_income_tax(gross, card)
        gross += net_salary - (gross - insurance - tax)
    return max(0.0, gross)


def calculate_employee_cost(
    payload: EmployeeCostCalculationRequest,
) -> EmployeeCostCalculationResponse:
    card = current_rate_card()
    if payload.is_net_contract:
        effective_base = _gross_up_from_net(payload.base_salary, card)
        effective_absorption = 0.0
        effective_responsibility = 0.0
        effective_superlative = 0.0
    else:
        effective_base = payload.base_salary
        effective_absorption = payload.job_absorption
        effective_responsibility = payload.responsibility_allowance
        effective_superlative = payload.job_superlative

    insurable_gross = (
        effective_base
        + effective_absorption
        + effective_responsibility
        + effective_superlative
    )
    total_gross = (
        insurable_gross
        + card.housing_allowance_rial
        + card.grocery_allowance_rial
        + payload.children_allowance
        + payload.other_benefits
    )
    hourly_rate = insurable_gross / payload.overtime_base_hours
    overtime_pay = hourly_rate * 1.4 * payload.overtime_hours
    variable_pay = overtime_pay + payload.monthly_performance + payload.monthly_bonus
    monthly_occasional_benefits = payload.annual_occasional_benefits / 12
    income_tax = _monthly_income_tax(insurable_gross, card)

    employer_insurance_rate = 0.30 if payload.is_net_contract else 0.23
    employer_insurance = insurable_gross * employer_insurance_rate
    employer_income_tax = income_tax if payload.is_net_contract else 0.0
    severance_accrual = effective_base / 12
    eidi_accrual = (effective_base * 2) / 12
    leave_redemption = (effective_base / 30) * 2.5
    total_statutory = (
        employer_insurance
        + employer_income_tax
        + severance_accrual
        + eidi_accrual
        + leave_redemption
    )
    total_welfare = payload.supplementary_insurance + monthly_occasional_benefits
    total_hidden_hr = payload.recruitment_cost + payload.training_cost + payload.misc_cost
    total_monthly_cost = (
        total_gross + variable_pay + total_statutory + total_welfare + total_hidden_hr
    )
    employee_insurance = 0.0 if payload.is_net_contract else insurable_gross * 0.07
    employee_tax = 0.0 if payload.is_net_contract else income_tax
    net_salary = (
        payload.base_salary
        if payload.is_net_contract
        else total_gross - employee_insurance - employee_tax
    )
    multiplier = total_monthly_cost / net_salary if net_salary > 0 else 0.0

    return EmployeeCostCalculationResponse(
        statutory_year=card.year,
        housing_allowance=float(card.housing_allowance_rial),
        grocery_allowance=float(card.grocery_allowance_rial),
        effective_base=effective_base,
        insurable_gross=insurable_gross,
        total_gross=total_gross,
        overtime_pay=overtime_pay,
        variable_pay=variable_pay,
        monthly_occasional_benefits=monthly_occasional_benefits,
        employer_insurance=employer_insurance,
        employer_income_tax=employer_income_tax,
        income_tax=income_tax,
        severance_accrual=severance_accrual,
        eidi_accrual=eidi_accrual,
        leave_redemption=leave_redemption,
        total_statutory=total_statutory,
        total_welfare=total_welfare,
        total_hidden_hr=total_hidden_hr,
        total_monthly_cost=total_monthly_cost,
        net_salary=net_salary,
        multiplier=multiplier,
        is_net_contract=payload.is_net_contract,
    )
