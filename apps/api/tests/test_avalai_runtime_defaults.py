from hring_api.config import Settings


def test_default_ai_feature_routes_use_active_avalai_aliases() -> None:
    settings = Settings(_env_file=None)

    assert settings.recruiting_ai_provider == "avalai.primary"
    assert settings.job_profile_ai_provider == "avalai.primary"
    assert settings.interview_ai_provider == "avalai.primary"
    assert settings.smart_ad_text_ai_provider == "avalai.primary"
    assert settings.smart_ad_image_ai_provider == "avalai.primary"
    assert settings.legal_advisor_ai_provider == "avalai.primary"
    assert settings.legal_defense_ai_provider == "avalai.primary"
    assert settings.recruiting_enrichment_provider == "avalai.search"
    assert settings.recruiting_enrichment_model == "sonar"
