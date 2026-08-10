<script setup lang="ts">
definePageMeta({ layout: 'auth' });

const runtimeConfig = useRuntimeConfig();
const { localizeAuthError } = useAuthErrorMessage();

const signInEmail = useSignIn('email');
const signInSocial = useSignIn('social');
const signUpEmail = useSignUp('email');

const canSignUp = runtimeConfig.public.authEnableSignup;
const canUseGithub = runtimeConfig.public.authEnableGithubOauth;

const isSigningUp = ref(false);
const email = ref('');
const password = ref('');
const name = ref('');

const action = computed(() => (isSigningUp.value ? signUpEmail : signInEmail));
const isPending = computed(
  () => action.value.status.value === 'pending' || signInSocial.status.value === 'pending',
);
const errorMessage = computed(() => {
  const error = action.value.error.value ?? signInSocial.error.value;
  return error ? localizeAuthError(error) : undefined;
});

async function onSubmit(): Promise<void> {
  if (isSigningUp.value) {
    await signUpEmail.execute({ email: email.value, password: password.value, name: name.value });
    return;
  }
  await signInEmail.execute({ email: email.value, password: password.value });
}

async function onGithub(): Promise<void> {
  await signInSocial.execute({ provider: 'github' });
}

function toggleMode(): void {
  isSigningUp.value = !isSigningUp.value;
  password.value = '';
}
</script>

<template>
  <section class="az-panel w-full max-w-88 p-6">
    <h1 class="m-0 text-lg font-650 tracking-tight">{{ $t('auth.login.title') }}</h1>
    <p class="mb-6 mt-1 text-xs text-muted">{{ $t('auth.login.subtitle') }}</p>

    <form class="flex flex-col gap-3" @submit.prevent="onSubmit">
      <label v-if="isSigningUp" class="flex flex-col gap-1.5">
        <span class="text-[9px] text-muted font-700 tracking-wider uppercase">
          {{ $t('auth.login.name') }}
        </span>
        <input
          v-model="name"
          class="az-focus h-9 border border-line bg-raised px-2.5 text-xs text-ink"
          autocomplete="name"
          required
          type="text"
        />
      </label>

      <label class="flex flex-col gap-1.5">
        <span class="text-[9px] text-muted font-700 tracking-wider uppercase">
          {{ $t('auth.login.email') }}
        </span>
        <input
          v-model="email"
          class="az-focus h-9 border border-line bg-raised px-2.5 text-xs text-ink"
          autocomplete="email"
          required
          type="email"
        />
      </label>

      <label class="flex flex-col gap-1.5">
        <span class="text-[9px] text-muted font-700 tracking-wider uppercase">
          {{ $t('auth.login.password') }}
        </span>
        <input
          v-model="password"
          class="az-focus h-9 border border-line bg-raised px-2.5 text-xs text-ink"
          :autocomplete="isSigningUp ? 'new-password' : 'current-password'"
          required
          type="password"
        />
      </label>

      <p
        v-if="errorMessage"
        class="m-0 border border-danger/35 bg-danger/8 p-2.5 text-xs text-danger"
        role="alert"
      >
        {{ errorMessage }}
      </p>

      <button
        class="az-focus h-9 flex items-center justify-center border border-accent/45 bg-accent/8 text-xs text-ink font-650 transition hover:border-accent disabled:cursor-wait disabled:opacity-60"
        :disabled="isPending"
        type="submit"
      >
        <template v-if="isSigningUp">
          {{ isPending ? $t('auth.login.signUpPending') : $t('auth.login.signUp') }}
        </template>
        <template v-else>
          {{ isPending ? $t('auth.login.submitPending') : $t('auth.login.submit') }}
        </template>
      </button>
    </form>

    <template v-if="canUseGithub">
      <p class="my-4 text-center text-[9px] text-muted font-700 tracking-wider uppercase">
        {{ $t('auth.login.separator') }}
      </p>
      <button
        class="az-focus h-9 w-full flex items-center justify-center border border-line bg-raised text-xs text-ink font-650 transition hover:border-muted disabled:cursor-wait disabled:opacity-60"
        :disabled="isPending"
        type="button"
        @click="onGithub"
      >
        {{ $t('auth.login.github') }}
      </button>
    </template>

    <button
      v-if="canSignUp"
      class="az-focus mt-5 w-full text-xs text-link"
      type="button"
      @click="toggleMode"
    >
      {{ isSigningUp ? $t('auth.login.toSignIn') : $t('auth.login.toSignUp') }}
    </button>
  </section>
</template>
