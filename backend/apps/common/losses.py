"""Bufor strat technologicznych — jedna wartość dla produkcji i finansów.

Produkcja odważa ciasto z tym zapasem (bufor ciasta), a finanse doliczają go do kosztu surowców
z receptur, więc koszt w finansach zgadza się z tym, co schodzi z magazynu. Receptura produktu
jest czystym składem sztuki, bez bufora.
"""
from decimal import Decimal

LOSS_BUFFER = Decimal('1.05')
LOSS_BUFFER_PCT = ((LOSS_BUFFER - 1) * 100).quantize(Decimal('0.01'))
