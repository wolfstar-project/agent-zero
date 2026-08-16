<!--
  Closing block: uppercase micro-label, the "safe to ignore" line, then any template-specific note.

  API: no props, one default slot appended under the standard line. Attributes (including `class`)
  fall through to the root div. `Base` pairs this with a `Divider` directly above it, which supplies
  the hairline top border — the component does not draw its own, so the two never double up.
-->
<template>
  <div
    class="font-[Inter,-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,Helvetica,Arial,sans-serif]"
  >
    <p
      class="m-0 text-[10px] font-bold tracking-[0.16em] text-[#48574D] uppercase dark:text-[#95A29B]"
    >
      Automated message
    </p>
    <p class="m-0 mt-2 text-[12px] leading-[20px] text-[#48574D] dark:text-[#95A29B]">
      If you were not expecting this message you can safely ignore it.
    </p>
    <slot />
  </div>
</template>
