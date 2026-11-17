# -*- coding: utf-8 -*-
"""IT 405L  --  LABORATORY ACTIVITY 2
Truth Tables and Deciding Equivalence by Code

    Gorduiz, Allysa F.
    2310005-2        slip A03-2        Section A        Group A03

THE VALUES BELOW ARE YOURS ALONE. A classmate may help you understand the work; a classmate
cannot answer it for you, because their answer belongs to their parameters, not to yours.

HOW TO USE THIS FILE
    1. Keep it in the same folder as the code you write. Your activity sheet names that file.
    2. Write your code there, following the steps on your sheet. The markers below are for your
       own notes.
    3. Run THIS file last:   python IT405_A02_2310005-2.py
       It imports your code, computes your stamp and prints one line. Put that line in stamp.txt.

Until you have written the function named at the bottom of this file, running it reports
ModuleNotFoundError or NameError. That is expected -- there is nothing to import yet.

It needs nothing but Python: no internet, no administrator rights and no installation, so it
behaves the same on a laboratory computer, on a borrowed laptop and on your own machine.
"""
import hashlib


# ==================================================================== YOUR PARAMETERS
STUDENT_NO = '2310005-2'

# The two formulas you must decide between.
E1 = '(p or (p and r))'
E2 = 'p'
VARIABLES = ['p', 'r']


# ==================================================================== YOUR WORK

# ---- Step 1: Write assignments(variables) that returns every combination of True and False for a ... ----



# ---- Step 2: Confirm the count is 2 to the power n for n = 1, 2, 3 and 4 before going on. ----



# ---- Step 3: Write truth_table(expr, variables) that prints a header row and one row per ... ----



# ---- Step 4: Produce the truth table for "p or not p" and for "p and not p". Name what you see in ... ----



# ---- Step 5: Write equivalent(expr1, expr2, variables) that returns True only when the two ... ----



# ---- Step 6: Use it to check De Morgan’s law: not (p and q) against (not p) or (not q). ----



# ---- Step 7: Use it to check "p implies q" against "not p or q". ----



# ---- Step 8: Now use equivalent on E1 and E2 from your own file. If they are not equivalent, ... ----



# ---- Step 9: Now test equivalent with two expressions that use different variable lists, for ... ----




# ==================================================================== THE STAMP -- DO NOT EDIT
# Computed from YOUR parameters and the answer YOUR OWN code produced. Run this last, and put the
# printed line in stamp.txt.
def stamp(student_no, activity, *values):
    payload = '|'.join([str(student_no).strip(), str(activity)] + [repr(v) for v in values])
    return hashlib.sha256(payload.encode('utf-8')).hexdigest()[:10].upper()


if __name__ == '__main__':
    # verdict  -> True or False: does YOUR equivalent() say E1 and E2 agree everywhere?
    # witness  -> if they differ, the row where they differ, in the shape "x=False,y=True"
    #             -- YOUR OWN variable names, in alphabetical order.
    #             The string "none" if they are equivalent.
    verdict = True      # <- replace with what your code returned
    witness = 'none'      # <- replace
    print(stamp(STUDENT_NO, 2, E1, E2, verdict, witness))
