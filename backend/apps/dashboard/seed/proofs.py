import math
from datetime import timedelta
from io import BytesIO
from pathlib import Path

from django.core.files.base import ContentFile
from PIL import Image, ImageDraw, UnidentifiedImageError

from orders.models import DailyOrder, DeliveryProof

PROOF_DAYS = 14
PHOTO_EVERY = 3
SIGNATURE_EVERY = 4
SIGNER_NAMES = ['A. Nowak', 'K. Mazur', 'M. Zielińska', 'P. Wójcik', 'E. Kamińska', 'T. Lis']
DELIVERY_PHOTO_PATH = Path(__file__).with_name('delivery_photo.jpg')
MAX_DELIVERY_PHOTO_SIZE = 5 * 1024 * 1024


def _encode(image, image_format, **options):
    buffer = BytesIO()
    image.save(buffer, image_format, **options)
    return buffer.getvalue()


def delivery_photo():
    if not DELIVERY_PHOTO_PATH.is_file():
        raise FileNotFoundError(f'Brak zdjęcia seedowego dostawy: {DELIVERY_PHOTO_PATH}')

    content = DELIVERY_PHOTO_PATH.read_bytes()
    if len(content) > MAX_DELIVERY_PHOTO_SIZE:
        raise ValueError('Zdjęcie seedowe dostawy nie może być większe niż 5 MB.')

    try:
        with Image.open(BytesIO(content)) as image:
            image.verify()
            image_format = image.format
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as error:
        raise ValueError(f'Zdjęcie seedowe dostawy jest nieprawidłowym obrazem: {DELIVERY_PHOTO_PATH}') from error

    extensions = {'JPEG': '.jpg', 'PNG': '.png', 'WEBP': '.webp'}
    extension = extensions.get(image_format)
    if extension is None:
        raise ValueError('Zdjęcie seedowe dostawy musi być w formacie JPEG, PNG lub WEBP.')
    return content, extension


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
    photo_content = None
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
                if photo_content is None:
                    photo_content = delivery_photo()
                content, extension = photo_content
                proof.image.save(f'delivery_photo{extension}', ContentFile(content), save=False)
            else:
                proof.image.save('signature.png', ContentFile(signature(seed)), save=False)
            proof.save()
            created_count += 1
    return created_count