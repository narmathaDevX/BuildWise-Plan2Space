from backend.app.services.materials import calculate_default_materials, summarize_materials


def test_materials_calculation_and_numeric_quantities():
    mats = calculate_default_materials(1850.0)
    assert len(mats) == 6

    # Verify all quantities and rates are numbers, not strings
    for m in mats:
        assert isinstance(m["quantity"], (int, float))
        assert isinstance(m["rate"], (int, float))
        assert isinstance(m["estimated_cost"], int)
        assert isinstance(m["purchased"], bool)

    # Check cement and steel defaults
    cement = next(m for m in mats if m["key"] == "cement")
    assert cement["quantity"] == 420
    assert cement["rate"] == 420.0
    assert cement["purchased"] is True

    summary = summarize_materials(mats)
    assert summary["rates_as_of"] == "October 2026"
    assert summary["total_count"] == 6
    assert summary["purchased_count"] == 2
    assert summary["purchase_progress"] == 33
    assert len(summary["categories"]) == 3
