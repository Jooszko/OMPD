from clients.models import Client, Route
from finance.models import (
    DailyFinancialReport,
    Expense,
    Supplier,
    SupplierIngredient,
)
from orders.models import DailyOrder, DeliveryProof, StandingOrder, StandingOrderRun
from production.models import Dough, Mixer, ProductionPlan
from products.models import Ingredient, IngredientStock, Product, Recipe
from users.models import Notification, User

from dashboard.seed.users import SEED_USERNAMES


def clear_all():
    for proof in DeliveryProof.objects.all():
        proof.image.delete(save=False)
    DailyFinancialReport.objects.all().delete()
    Expense.objects.all().delete()
    SupplierIngredient.objects.all().delete()
    Supplier.objects.all().delete()
    ProductionPlan.objects.all().delete()
    DailyOrder.objects.all().delete()
    StandingOrderRun.objects.all().delete()
    StandingOrder.objects.all().delete()
    Recipe.objects.all().delete()
    Product.objects.all().delete()
    Dough.objects.all().delete()
    Mixer.objects.all().delete()
    IngredientStock.objects.all().delete()
    Ingredient.objects.all().delete()
    Client.objects.all().delete()
    Route.objects.all().delete()
    Notification.objects.all().delete()
    User.objects.filter(username__in=SEED_USERNAMES).delete()
