import logging
import os
import smtplib
import ssl
from email.message import EmailMessage
from io import BytesIO

import qrcode
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Booking, Event, Ticket


logger = logging.getLogger(__name__)


def _smtp_configuration() -> tuple[str, int, str, str, str, bool, bool]:
    host = os.getenv("SMTP_HOST")
    sender = os.getenv("SMTP_FROM_EMAIL")
    username = os.getenv("SMTP_USERNAME", "")
    password = os.getenv("SMTP_PASSWORD", "")
    ssl_setting = os.getenv("SMTP_USE_SSL", "false").lower()
    tls_setting = os.getenv("SMTP_USE_TLS", "true").lower()

    if not host or not sender:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Email delivery is not configured. Set SMTP_HOST and SMTP_FROM_EMAIL.",
        )
    if ssl_setting not in {"true", "false"} or tls_setting not in {"true", "false"}:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SMTP_USE_SSL and SMTP_USE_TLS must be set to true or false.",
        )
    use_ssl = ssl_setting == "true"
    use_starttls = tls_setting == "true"
    if bool(username) != bool(password):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SMTP_USERNAME and SMTP_PASSWORD must both be configured.",
        )
    if username and not (use_ssl or use_starttls):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SMTP authentication requires SMTP_USE_TLS or SMTP_USE_SSL.",
        )
    if use_ssl and use_starttls:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SMTP_USE_SSL and SMTP_USE_TLS cannot both be enabled.",
        )

    try:
        port = int(os.getenv("SMTP_PORT", "587"))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SMTP_PORT must be a valid port number.",
        ) from None
    if not 1 <= port <= 65535:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SMTP_PORT must be between 1 and 65535.",
        )

    return host, port, sender, username, password, use_ssl, use_starttls


def _build_ticket_email(
    booking: Booking,
    event: Event,
    tickets: list[Ticket],
    sender: str,
) -> EmailMessage:
    message = EmailMessage()
    message["Subject"] = f"Your tickets for {event.name}"
    message["From"] = sender
    message["To"] = booking.buyer_email

    ticket_codes = "\n".join(f"- {ticket.ticket_code}" for ticket in tickets)
    message.set_content(
        f"Hello {booking.buyer_name},\n\n"
        f"Your booking for {event.name} is confirmed.\n"
        f"Booking code: {booking.booking_code}\n"
        f"Event date: {event.event_date}\n"
        f"Venue: {event.venue}\n\n"
        "Your individual ticket QR codes are attached as PNG images. "
        "Each QR code contains the corresponding ticket code:\n"
        f"{ticket_codes}\n"
    )

    for ticket in tickets:
        image = qrcode.make(ticket.ticket_code)
        image_data = BytesIO()
        image.save(image_data, format="PNG")
        message.add_attachment(
            image_data.getvalue(),
            maintype="image",
            subtype="png",
            filename=f"{ticket.ticket_code}.png",
        )

    return message


def send_booking_tickets(db: Session, booking_id: int) -> dict[str, int | str]:
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if booking is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found.",
        )
    if booking.status != "CONFIRMED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tickets can only be sent for confirmed bookings.",
        )

    event = db.query(Event).filter(Event.id == booking.event_id).first()
    tickets = (
        db.query(Ticket)
        .filter(Ticket.booking_id == booking.id, Ticket.status == "CONFIRMED")
        .order_by(Ticket.id.asc())
        .all()
    )
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The event for this booking could not be found.",
        )
    if len(tickets) != booking.quantity:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The booking does not have the expected number of confirmed tickets.",
        )

    host, port, sender, username, password, use_ssl, use_starttls = _smtp_configuration()
    message = _build_ticket_email(booking, event, tickets, sender)

    try:
        if use_ssl:
            with smtplib.SMTP_SSL(
                host,
                port,
                timeout=15,
                context=ssl.create_default_context(),
            ) as smtp:
                if username:
                    smtp.login(username, password)
                smtp.send_message(message)
        else:
            with smtplib.SMTP(host, port, timeout=15) as smtp:
                if use_starttls:
                    smtp.starttls(context=ssl.create_default_context())
                if username:
                    smtp.login(username, password)
                smtp.send_message(message)
    except (OSError, smtplib.SMTPException):
        logger.exception("Could not send tickets for booking %s", booking_id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not deliver the ticket email. Check the SMTP configuration and try again.",
        ) from None

    return {
        "message": "Ticket email sent successfully.",
        "recipient": booking.buyer_email,
        "tickets_sent": len(tickets),
    }


def send_booking_tickets_in_background(booking_id: int) -> None:
    db = SessionLocal()
    try:
        result = send_booking_tickets(db, booking_id)
        logger.info(
            "Automatically sent %s tickets for booking %s to %s",
            result["tickets_sent"],
            booking_id,
            result["recipient"],
        )
    except HTTPException as error:
        logger.error(
            "Could not automatically send tickets for booking %s: %s",
            booking_id,
            error.detail,
        )
    finally:
        db.close()
