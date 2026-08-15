<!--
  Square emphasis panel: accent-tint fill, 1px accent border, no radius.

  API: no props, one default slot. Attributes (including `class`) fall through to the root div.
  The tint is pre-composited to a solid hex because Outlook's Word engine drops alpha colours.
-->
<template>
  <div
    class="border border-[#1C6A00] border-solid bg-[#E6EFE4] p-4 dark:border-[#84E04F] dark:bg-[#111E0F]"
  >
    <slot />
  </div>
</template>
