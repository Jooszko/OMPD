from django.db import models


class AuditEntry(models.Model):
    CATEGORY_CHOICES = [
        ('accounts', 'Konta i logowanie'),
        ('clients', 'Klienci'),
        ('products', 'Produkty i receptury'),
        ('orders', 'Zamówienia'),
        ('finance', 'Finanse'),
        ('logistics', 'Logistyka'),
    ]

    entry_id = models.BigAutoField(primary_key=True)
    created_at = models.DateTimeField(auto_now_add=True)
    actor = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_entries'
    )
    actor_name = models.CharField(max_length=200, blank=True, default='')
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    action = models.CharField(max_length=50)
    object_type = models.CharField(max_length=50, blank=True, default='')
    object_id = models.CharField(max_length=64, blank=True, default='')
    object_label = models.CharField(max_length=255, blank=True, default='')
    description = models.TextField()
    changes = models.JSONField(default=list, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at', '-entry_id']
        indexes = [
            models.Index(fields=['category', '-created_at'], name='audit_category_time'),
            models.Index(fields=['actor', '-created_at'], name='audit_actor_time'),
        ]
        verbose_name = 'wpis dziennika'
        verbose_name_plural = 'dziennik zmian'

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ValueError('Wpisów dziennika zmian nie można modyfikować.')
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.created_at:%Y-%m-%d %H:%M} {self.actor_name or "system"}: {self.description}'