import pytest

from hring_api.domains.costing.schemas import EmployeeCostCalculationRequest
from hring_api.domains.costing.service import calculate_employee_cost, current_rates_response


def test_current_statutory_rates_are_1405() -> None:
    rates = current_rates_response()

    assert rates.year == 1405
    assert rates.housing_allowance_rial == 30_000_000
    assert rates.grocery_allowance_rial == 22_000_000
    assert rates.tax_brackets[0].upper_bound_rial == 4_800_000_000
    assert rates.tax_brackets[-1].rate == 0.30


def test_employee_cost_uses_progressive_1405_tax() -> None:
    result = calculate_employee_cost(
        EmployeeCostCalculationRequest(base_salary=500_000_000)
    )

    assert result.statutory_year == 1405
    assert result.total_gross == 552_000_000
    assert result.income_tax == pytest.approx(10_000_000)
    assert result.employer_insurance == pytest.approx(115_000_000)
    assert result.net_salary == pytest.approx(507_000_000)


def test_net_contract_preserves_requested_net_salary() -> None:
    result = calculate_employee_cost(
        EmployeeCostCalculationRequest(
            is_net_contract=True,
            base_salary=500_000_000,
            job_absorption=50_000_000,
        )
    )

    assert result.is_net_contract is True
    assert result.net_salary == 500_000_000
    assert result.effective_base > result.net_salary
    assert result.insurable_gross == result.effective_base
