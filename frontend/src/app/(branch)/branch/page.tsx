// The gym admin's overview page is already scoped correctly for anyone who
// isn't unscoped (BranchFilter hides itself, and every hook it calls is
// forced to this viewer's own branch server-side) — reused as-is rather
// than forked, so there's one dashboard implementation to keep correct.
export { default } from "@/app/(dashboard)/dashboard/page"
