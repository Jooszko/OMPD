import math
from datetime import timedelta
from io import BytesIO

from django.core.files.base import ContentFile
from django.utils import timezone
from PIL import Image, ImageDraw, ImageFont

from orders.models import DailyOrder, DeliveryProof
from dashboard.seed.orders import SEED_TIMEZONE

PROOF_DAYS = 14
PHOTO_EVERY = 3
SIGNATURE_EVERY = 4
SIGNER_NAMES = ['A. Nowak', 'K. Mazur', 'M. Zielińska', 'P. Wójcik', 'E. Kamińska', 'T. Lis']
WALL_COLORS = ['#d9d4c7', '#c9d3d9', '#e3d5c3', '#cfd8c5']
CRATE_COLORS = ['#d9822b', '#3c7dc4', '#4f9a54']


def _encode(image, image_format, **options):
    buffer = BytesIO()
    image.save(buffer, image_format, **options)
    return buffer.getvalue()


def delivery_photo(seed, moment):
    image = Image.new('RGB', (640, 480), WALL_COLORS[seed % len(WALL_COLORS)])
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 360, 640, 480), fill='#8a8a85')
    draw.rectangle((430, 90, 570, 360), fill='#6b4f3a')
    draw.ellipse((545, 220, 557, 232), fill='#d4b483')
    crate = CRATE_COLORS[seed % len(CRATE_COLORS)]
    for column in range(2 + seed % 2):
        height = 1 + (seed + column) % 3
        left = 50 + column * 115
        for row in range(height):
            top = 305 - row * 60
            draw.rectangle((left, top, left + 105, top + 55), fill=crate, outline='#333333', width=2)
            draw.rectangle((left + 38, top + 10, left + 68, top + 20), fill='#333333')
        draw.ellipse((left + 12, 305 - height * 60 + 40, left + 93, 305 - height * 60 + 62), fill='#c8913f')
    stamp = timezone.localtime(moment, SEED_TIMEZONE).strftime('%Y-%m-%d %H:%M')
    draw.text((620, 465), stamp, font=ImageFont.load_default(size=20), fill='#ffb000', anchor='rs')
    return _encode(image, 'JPEG', quality=70)


def signature(seed):
    image = Image.new('RGB', (600, 200), 'white')
    draw = ImageDraw.Draw(image)
    draw.line((40, 160, 560, 160), fill='#bbbbbb', width=2)
    loop = 2 + seed % 3 / 2
    points = []
    for step in range(170):
        height = 38 * (0.6 + 0.4 * math.sin(step / (7 + seed % 5)))
        points.append((70 + step * 2.6 + 16 * math.cos(step / loop), 110 - height * math.sin(step / loop)))
    draw.line(points, fill='#1a237e', width=3, joint='curve')
    return _encode(image, 'PNG')


def create_delivery_proofs(today):
    start = today - timedelta(days=PROOF_DAYS)
    stops = {}
    delivered = DailyOrder.objects.filter(order_date__range=(start, today), status='delivered').order_by('do_id')
    for order in delivered:
        stops.setdefault((order.client_id, order.order_date), order)

    taken = set(
        DeliveryProof.objects
        .filter(order_date__range=(start, today))
        .values_list('client_id', 'order_date', 'kind')
    )
    created_count = 0
    for (client_id, order_date), order in stops.items():
        seed = client_id + order_date.toordinal()
        kinds = (['photo'] if seed % PHOTO_EVERY else []) + (['signature'] if seed % SIGNATURE_EVERY == 0 else [])
        for kind in kinds:
            if (client_id, order_date, kind) in taken:
                continue
            proof = DeliveryProof(
                client_id=client_id,
                order_date=order_date,
                kind=kind,
                signer_name=SIGNER_NAMES[seed % len(SIGNER_NAMES)] if kind == 'signature' else '',
                uploaded_by_id=order.assigned_driver_id,
            )
            if kind == 'photo':
                proof.image.save('photo.jpg', ContentFile(delivery_photo(seed, order.delivered_at)), save=False)
            else:
                proof.image.save('signature.png', ContentFile(signature(seed)), save=False)
            proof.save()
            created_count += 1
    return created_count