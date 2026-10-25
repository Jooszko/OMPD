from django.test import TestCase
from drf_spectacular.generators import SchemaGenerator

HTTP_METHODS = {'get', 'post', 'put', 'patch', 'delete'}


class ApiSchemaTests(TestCase):
    def setUp(self):
        self.schema = SchemaGenerator().get_schema(request=None, public=True)

    def operations(self):
        for path, operations in self.schema['paths'].items():
            for method, operation in operations.items():
                if method in HTTP_METHODS:
                    yield f'{method.upper()} {path}', operation

    def test_schema_lists_main_endpoints(self):
        for path in ['/api/orders/day/', '/api/logistics/', '/api/users/me/', '/api/auth/login/']:
            self.assertIn(path, self.schema['paths'])

    def test_jwt_bearer_scheme_is_documented(self):
        scheme = self.schema['components']['securitySchemes']['jwtAuth']
        self.assertEqual(scheme['type'], 'http')
        self.assertEqual(scheme['scheme'], 'bearer')

    def test_every_endpoint_is_described(self):
        missing = [name for name, operation in self.operations() if not operation.get('summary')]
        self.assertEqual(missing, [])

    def test_successful_responses_have_a_body_description(self):
        empty = [
            f'{name} → {code}'
            for name, operation in self.operations()
            for code, response in operation['responses'].items()
            if code in ('200', '201') and 'content' not in response
        ]
        self.assertEqual(empty, [])