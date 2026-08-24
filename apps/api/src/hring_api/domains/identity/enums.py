from enum import StrEnum


class AppRole(StrEnum):
    ADMIN = "admin"
    MODERATOR = "moderator"
    USER = "user"


class CompanyRole(StrEnum):
    CEO = "ceo"
    DEPUTY = "deputy"
    MANAGER = "manager"
    EMPLOYEE = "employee"


class CompanyStatus(StrEnum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    TRIAL = "trial"


class CompassRole(StrEnum):
    CEO = "ceo"
    DEPUTY = "deputy"
    MANAGER = "manager"
    EXPERT = "expert"


class SubscriptionTier(StrEnum):
    INDIVIDUAL_FREE = "individual_free"
    INDIVIDUAL_PRO = "individual_pro"
    INDIVIDUAL_PLUS = "individual_plus"
    CORPORATE_EXPERT = "corporate_expert"
    CORPORATE_DECISION_SUPPORT = "corporate_decision_support"
    CORPORATE_DECISION_MAKING = "corporate_decision_making"
