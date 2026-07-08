from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from .models import Supplier, SupplierIngredient
from .serializers import SupplierSerializer
from products.models import Ingredient

class SupplierListView(APIView):
    def get(self, request):
        suppliers = Supplier.objects.all().prefetch_related('ingredients_catalog__ingredient')
        serializer = SupplierSerializer(suppliers, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        products_data = request.data.pop('products', [])
        serializer = SupplierSerializer(data=request.data)
        
        if serializer.is_valid():
            supplier = serializer.save()
            
            for p in products_data:
                try:
                    ingredient = Ingredient.objects.get(pk=p.get('product_id'))
                    SupplierIngredient.objects.get_or_create(supplier=supplier, ingredient=ingredient)
                except Ingredient.DoesNotExist:
                    continue
                    
            return Response(SupplierSerializer(supplier).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class SupplierDetailView(APIView):
    def put(self, request, pk):
        supplier = get_object_or_404(Supplier, pk=pk)
        
        data = request.data.copy() if hasattr(request.data, 'copy') else request.data
        products_data = data.pop('products', [])
        
        serializer = SupplierSerializer(supplier, data=data, partial=True)
        
        if serializer.is_valid():
            serializer.save()
            
            SupplierIngredient.objects.filter(supplier=supplier).delete()
            for p in products_data:
                try:
                    ingredient = Ingredient.objects.get(pk=p.get('product_id'))
                    SupplierIngredient.objects.get_or_create(supplier=supplier, ingredient=ingredient)
                except Ingredient.DoesNotExist:
                    continue
            
            return Response(SupplierSerializer(supplier).data, status=status.HTTP_200_OK)
        
        print("BŁĘDY WALIDACJI:", serializer.errors)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)