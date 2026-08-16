<template>
  <form class="mt-8" novalidate @submit.prevent="onSubmit">
    <div class="grid gap-4 sm:grid-cols-2">
      <label class="flex flex-col gap-1.5 text-xs text-muted font-650">
        {{ $t('marketing.pages.contact.form.nameLabel') }}
        <input
          v-model.trim="name"
          class="input-field"
          type="text"
          name="name"
          autocomplete="name"
          required
          :placeholder="$t('marketing.pages.contact.form.namePlaceholder')"
        />
      </label>
      <label class="flex flex-col gap-1.5 text-xs text-muted font-650">
        {{ $t('marketing.pages.contact.form.emailLabel') }}
        <input
          v-model.trim="email"
          class="input-field"
          type="email"
          name="email"
          autocomplete="email"
          required
          :placeholder="$t('marketing.pages.contact.form.emailPlaceholder')"
        />
      </label>
    </div>

    <label class="mt-4 flex flex-col gap-1.5 text-xs text-muted font-650">
      {{ $t('marketing.pages.contact.form.messageLabel') }}
      <textarea
        v-model.trim="message"
        class="focus-ring min-h-32 resize-y border border-line bg-raised px-2.5 py-2 text-xs text-ink"
        name="message"
        rows="5"
        required
        :placeholder="$t('marketing.pages.contact.form.messagePlaceholder')"
      />
    </label>

    <p v-if="error" class="m-0 mt-3 text-xs text-danger" role="alert">
      {{ $t('marketing.pages.contact.form.requiredError') }}
    </p>

    <div class="mt-5 flex flex-wrap items-center gap-4">
      <button class="btn btn-accent" type="submit">
        {{ $t('marketing.pages.contact.form.submit') }}
      </button>
      <p class="m-0 text-xs text-muted">{{ $t('marketing.pages.contact.form.hint') }}</p>
    </div>
  </form>
</template>

<script setup lang="ts">
const { links } = useAppConfig();

const name = ref('');
const email = ref('');
const message = ref('');
const error = ref(false);

// No backend, no persistence (this app owns neither — see the README) — the only honest way to
// "submit" a contact form here is to hand the visitor's own email client a pre-filled draft.
function onSubmit(): void {
  if (!name.value || !email.value || !message.value) {
    error.value = true;
    return;
  }
  error.value = false;

  const subject = `Message from ${name.value}`;
  const body = `${message.value}\n\n—\n${name.value}\n${email.value}`;
  const mailto = `mailto:${links.contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  window.location.href = mailto;
}
</script>
