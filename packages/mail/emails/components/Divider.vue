<!--
  A 1px hairline rule in the `line` colour.

  API: no props. Attributes (including `class`) fall through to the root table.
  A background-filled `<td>` rather than `<hr>`, which clients style inconsistently. The `&nbsp;`
  stops Outlook collapsing the cell and must stay glued to the tags — padded onto its own line the
  serializer folds it into ordinary collapsible whitespace.
-->
<template>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="w-full">
    <tbody>
      <tr>
        <td height="1" class="h-px bg-[#BFC7BF] text-[1px]/[1px] dark:bg-[#28302B]">&nbsp;</td>
      </tr>
    </tbody>
  </table>
</template>
