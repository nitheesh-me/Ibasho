/-
Ibasho spec V2: complete enumeration of packages (SPEC R9, 7.3, ARCH 8.3, DEC TE-1). Owner: WP-04.

The search is factorised into choice groups (`loft`, `wall`, `heat`, ...), each with its options
including `none`. A package is one option per group. Lean rebuilds the product itself and the
certificate check `enum.complete` matches the claimed list to it one to one, in order, so no
package can be silently dropped (`enum_complete_sound`) and none invented.
-/

namespace Ibasho.Spec.V2

/-- Cartesian product of the choice groups, first group outermost (TS search order). -/
def product {α : Type} : List (List α) → List (List α)
  | [] => [[]]
  | g :: gs => g.flatMap fun o => (product gs).map (o :: ·)

/-- A choice vector picks one option from each group, in group order. -/
def IsChoice {α : Type} : List α → List (List α) → Prop
  | [], [] => True
  | c :: cs, g :: gs => c ∈ g ∧ IsChoice cs gs
  | _, _ => False

theorem mem_product {α : Type} : ∀ (gs : List (List α)) (c : List α),
    c ∈ product gs ↔ IsChoice c gs
  | [], c => by cases c <;> simp [product, IsChoice]
  | g :: gs, c => by
    simp only [product, List.mem_flatMap, List.mem_map]
    cases c with
    | nil => simp [IsChoice]
    | cons x xs =>
      simp only [IsChoice, List.cons.injEq]
      constructor
      · rintro ⟨o, ho, ys, hys, rfl, rfl⟩
        exact ⟨ho, (mem_product gs ys).mp hys⟩
      · rintro ⟨hx, hxs⟩
        exact ⟨x, hx, xs, (mem_product gs xs).mpr hxs, rfl, rfl⟩

/-- Number of packages: the product of the group sizes. -/
theorem product_length {α : Type} : ∀ gs : List (List α),
    (product gs).length = (gs.map List.length).foldr (· * ·) 1
  | [] => rfl
  | g :: gs => by
    simp only [product, List.length_flatMap, List.length_map, product_length gs, List.map_cons,
      List.foldr_cons]
    induction g with
    | nil => simp
    | cons _ _ ih => simp [ih, Nat.add_mul, Nat.add_comm]

/-- Certificate check `enum.complete`: the claimed packages are exactly the product. -/
def checkEnum {α : Type} [DecidableEq α] (groups : List (List α)) (claimed : List (List α)) : Bool :=
  claimed == product groups

/-- Every package of the search space is in the certificate, and nothing else is. -/
theorem enum_complete_sound {α : Type} [DecidableEq α] {groups claimed : List (List α)}
    (h : checkEnum groups claimed = true) :
    (∀ c, IsChoice c groups → c ∈ claimed) ∧ (∀ c ∈ claimed, IsChoice c groups) := by
  have he : claimed = product groups := by simpa [checkEnum] using h
  subst he
  exact ⟨fun c hc => (mem_product groups c).mpr hc, fun c hc => (mem_product groups c).mp hc⟩

#guard product [["none", "270"], ["none", "ashp"]] ==
  [["none", "none"], ["none", "ashp"], ["270", "none"], ["270", "ashp"]]
-- GH1 light variants (SPEC 9): (1 + 2·2) × (1 + 3·3) = 50.
#guard (product [List.range 5, List.range 10]).length == 50

end Ibasho.Spec.V2
