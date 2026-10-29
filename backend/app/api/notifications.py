import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_active_user
from app.models.notification import Notification
from app.models.user import User
from app.models.user_notification_preference import UserNotificationPreference
from app.schemas.notification import (
    CheckPhoneVerificationRequest,
    CheckPhoneVerificationResponse,
    NotificationListResponse,
    NotificationPreferenceResponse,
    NotificationPreferenceUpdateRequest,
    NotificationRecordResponse,
    StartPhoneVerificationRequest,
    StartPhoneVerificationResponse,
    TestAlertResponse,
)
from app.security.rate_limiter import rate_limit
from app.services.notification_service import notification_service
from app.services.token_encryption_service import token_encryption_service

logger = logging.getLogger("phishguard.api.notifications")

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.post(
    "/phone/start-verification",
    response_model=StartPhoneVerificationResponse,
    dependencies=[Depends(rate_limit("general"))],
)
async def start_phone_verification(
    req: StartPhoneVerificationRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Validates E.164 phone format and initiates OTP phone verification.
    Stores the phone number encrypted at rest with unverified status until OTP confirmation.
    """
    try:
        normalized_phone = notification_service.validate_e164_phone(req.phone_number)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    # Initialize or update preference record with encrypted phone
    pref = (
        db.query(UserNotificationPreference)
        .filter(UserNotificationPreference.user_id == current_user.id)
        .first()
    )

    encrypted_phone = token_encryption_service.encrypt(normalized_phone)
    masked_phone = notification_service.mask_phone_number(normalized_phone)

    if not pref:
        pref = UserNotificationPreference(
            user_id=current_user.id,
            encrypted_phone_number=encrypted_phone,
            masked_phone_number=masked_phone,
            is_phone_verified=False,
            sms_alerts_enabled=False,
        )
        db.add(pref)
    else:
        pref.encrypted_phone_number = encrypted_phone
        pref.masked_phone_number = masked_phone
        pref.is_phone_verified = False
        pref.sms_alerts_enabled = False

    db.commit()

    try:
        verify_data = await notification_service.start_phone_verification(normalized_phone)
        return StartPhoneVerificationResponse(
            status=verify_data["status"],
            phone_number_masked=masked_phone,
            mock_mode=verify_data.get("mock_mode", False),
            message=verify_data.get("message", f"Verification code sent to {masked_phone}"),
        )
    except Exception as e:
        logger.error(f"Error starting phone verification for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send verification code. Please try again later.",
        )


@router.post(
    "/phone/check-verification",
    response_model=CheckPhoneVerificationResponse,
    dependencies=[Depends(rate_limit("general"))],
)
async def check_phone_verification(
    req: CheckPhoneVerificationRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Confirms submitted verification code and marks user's phone as verified.
    """
    pref = (
        db.query(UserNotificationPreference)
        .filter(UserNotificationPreference.user_id == current_user.id)
        .first()
    )

    if not pref or not pref.encrypted_phone_number:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No phone number pending verification. Please initiate verification first.",
        )

    try:
        normalized_phone = notification_service.validate_e164_phone(req.phone_number)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    # Verify code
    is_approved = await notification_service.check_phone_verification(normalized_phone, req.code)
    if not is_approved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification code. Please try again.",
        )

    pref.is_phone_verified = True
    db.commit()
    logger.info(f"Phone successfully verified for user {current_user.id}")

    return CheckPhoneVerificationResponse(
        success=True,
        message="Phone number verified successfully.",
        is_phone_verified=True,
    )


@router.get(
    "/preferences",
    response_model=NotificationPreferenceResponse,
    dependencies=[Depends(rate_limit("general"))],
)
async def get_notification_preferences(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Returns notification preferences and masked phone number for the authenticated user.
    """
    pref = (
        db.query(UserNotificationPreference)
        .filter(UserNotificationPreference.user_id == current_user.id)
        .first()
    )

    if not pref:
        # Create default preferences
        pref = UserNotificationPreference(
            user_id=current_user.id,
            is_phone_verified=False,
            sms_alerts_enabled=False,
            risk_threshold=80,
            browser_alerts_enabled=True,
            alerts_paused=False,
        )
        db.add(pref)
        db.commit()
        db.refresh(pref)

    return NotificationPreferenceResponse.model_validate(pref)


@router.patch(
    "/preferences",
    response_model=NotificationPreferenceResponse,
    dependencies=[Depends(rate_limit("general"))],
)
async def update_notification_preferences(
    req: NotificationPreferenceUpdateRequest,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Updates user notification preferences with mandatory opt-in consent enforcement.
    """
    pref = (
        db.query(UserNotificationPreference)
        .filter(UserNotificationPreference.user_id == current_user.id)
        .first()
    )

    if not pref:
        pref = UserNotificationPreference(
            user_id=current_user.id,
            is_phone_verified=False,
            sms_alerts_enabled=False,
            risk_threshold=80,
        )
        db.add(pref)
        db.flush()

    # Enforce phone verification and consent when enabling SMS alerts
    if req.sms_alerts_enabled is True:
        if not pref.is_phone_verified or not pref.encrypted_phone_number:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You must verify your phone number before enabling SMS alerts.",
            )
        if not req.consent_accepted and not pref.consent_recorded_at:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Explicit opt-in consent is required to receive SMS security alerts.",
            )

        now = datetime.now(timezone.utc)
        pref.sms_alerts_enabled = True
        pref.consent_recorded_at = now
        client_host = request.client.host if request.client else "unknown"
        pref.consent_ip = client_host
        pref.opt_out_at = None
    elif req.sms_alerts_enabled is False:
        pref.sms_alerts_enabled = False
        pref.opt_out_at = datetime.now(timezone.utc)

    if req.risk_threshold is not None:
        pref.risk_threshold = req.risk_threshold

    if req.browser_alerts_enabled is not None:
        pref.browser_alerts_enabled = req.browser_alerts_enabled

    if req.alerts_paused is not None:
        pref.alerts_paused = req.alerts_paused

    db.commit()
    db.refresh(pref)
    return NotificationPreferenceResponse.model_validate(pref)


@router.post(
    "/test",
    response_model=TestAlertResponse,
    dependencies=[Depends(rate_limit("general"))],
)
async def send_test_notification(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Dispatches a safe test SMS alert to verify user's messaging configuration.
    """
    pref = (
        db.query(UserNotificationPreference)
        .filter(UserNotificationPreference.user_id == current_user.id)
        .first()
    )

    if not pref or not pref.is_phone_verified or not pref.encrypted_phone_number:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No verified phone number found. Please verify your phone number first.",
        )

    try:
        plain_phone = token_encryption_service.decrypt(pref.encrypted_phone_number)
    except Exception as e:
        logger.error(f"Failed to decrypt phone for user {current_user.id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to decrypt credentials.")

    test_message = "PhishGuard test notification: Your SMS alert configuration is active and working properly."
    dispatch = await notification_service.send_sms_alert(plain_phone, test_message)

    delivery_status = dispatch.get("status", "failed")
    now = datetime.now(timezone.utc)

    notification = Notification(
        user_id=current_user.id,
        monitored_message_id=None,
        channel="sms",
        status=delivery_status,
        provider_message_id=dispatch.get("provider_message_id"),
        sent_at=now if delivery_status == "sent" else None,
        failure_reason=dispatch.get("error"),
        created_at=now,
    )
    db.add(notification)
    db.commit()

    if delivery_status != "sent":
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to deliver test SMS: {dispatch.get('error', 'Provider error')}",
        )

    return TestAlertResponse(
        success=True,
        message=f"Test SMS alert sent successfully to {pref.masked_phone_number}.",
        channel="sms",
    )


@router.get(
    "",
    response_model=NotificationListResponse,
    dependencies=[Depends(rate_limit("general"))],
)
async def list_notifications(
    limit: int = Query(20, ge=1, le=100, description="Maximum number of notification logs to retrieve"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Returns delivery audit logs for notifications dispatched to the current user.
    """
    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .all()
    )

    return NotificationListResponse(
        notifications=[NotificationRecordResponse.model_validate(n) for n in notifications],
        count=len(notifications),
    )


@router.delete(
    "/phone",
    dependencies=[Depends(rate_limit("general"))],
)
async def delete_phone_number(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Removes the user's stored phone number and disables SMS notifications.
    """
    pref = (
        db.query(UserNotificationPreference)
        .filter(UserNotificationPreference.user_id == current_user.id)
        .first()
    )

    if pref:
        pref.encrypted_phone_number = None
        pref.masked_phone_number = None
        pref.is_phone_verified = False
        pref.sms_alerts_enabled = False
        pref.opt_out_at = datetime.now(timezone.utc)
        db.commit()

    return {"success": True, "message": "Phone number removed and SMS notifications disabled."}
