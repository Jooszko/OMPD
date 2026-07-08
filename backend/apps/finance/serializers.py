from rest_framework import serializers
from .models import Supplier, SupplierIngredient
from products.models import Ingredient

class SupplierProductSerializer(serializers.ModelSerializer):
    """Serializer mapujący produkt z perspektywy kontrahenta"""
    product_id = serializers.IntegerField(source='ingredient.ingredient_id')
    name = serializers.CharField(source='ingredient.name')

    class Meta:
        model = SupplierIngredient
        fields = ['product_id', 'name']

class SupplierSerializer(serializers.ModelSerializer):
    products = SupplierProductSerializer(source='ingredients_catalog', many=True, read_only=True)
    
    nip = serializers.CharField(allow_blank=True, allow_null=True, required=False)

    class Meta:
        model = Supplier
        fields = [
            'supplier_id', 
            'name', 
            'phone', 
            'email', 
            'address', 
            'nip', 
            'is_active', 
            'products'
        ]

    def validate_nip(self, value):
        """Opcjonalna walidacja formatu NIP (10 cyfr)"""
        if value:
            clean_nip = value.replace('-', '').replace(' ', '')
            if not clean_nip.isdigit() or len(clean_nip) != 10:
                raise serializers.ValidationError("NIP musi składać się z 10 cyfr.")
            return clean_nip
        return value