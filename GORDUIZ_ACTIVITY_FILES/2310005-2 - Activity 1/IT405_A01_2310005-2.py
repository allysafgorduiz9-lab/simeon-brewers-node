# -*- coding: utf-8 -*-
"""IT 405L  --  LABORATORY ACTIVITY 1
Logical Operators and an Expression Evaluator

    Gorduiz, Allysa F.
    2310005-2        slip A03-2        Section A        Group A03

THE VALUES BELOW ARE YOURS ALONE. A classmate may help you understand the work; a classmate
cannot answer it for you, because their answer belongs to their parameters, not to yours.

HOW TO USE THIS FILE
    1. Keep it in the same folder as the code you write. Your activity sheet names that file.
    2. Write your code there, following the steps on your sheet. The markers below are for your
       own notes.
    3. Run THIS file last:   python IT405_A01_2310005-2.py
       It imports your code, computes your stamp and prints one line. Put that line in stamp.txt.

Until you have written the function named at the bottom of this file, running it reports
ModuleNotFoundError or NameError. That is expected -- there is nothing to import yet.

It needs nothing but Python: no internet, no administrator rights and no installation, so it
behaves the same on a laboratory computer, on a borrowed laptop and on your own machine.
"""
import hashlib


# ==================================================================== YOUR PARAMETERS
STUDENT_NO = '2310005-2'

# The expression you must evaluate, in the nested-tuple form your evaluator takes.
EXPR = ('and', ('implies', ('not', False), ('and', False, True)), ('or', ('not', False), ('not', True)))

# The same expression written out, for your hand working.
EXPR_TEXT = '((not False implies (False and True)) and (not False or not True))'


# ==================================================================== YOUR WORK

# ---- Step 1: Open a terminal and confirm your Python version with python --version. Record the ... ----



# ---- Step 2: In a new file logic_ops.py, write three functions: my_and(a, b), my_or(a, b) and ... ----



# ---- Step 3: Write a fourth function my_implies(a, b) that returns the truth value of "a implies ... ----



# ---- Step 4: For every function, print the result for all combinations of True and False. Compare ... ----



# ---- Step 5: Write evaluate(expr) that takes a nested tuple such as ("and", True, ("not", False)) ... ----



# ---- Step 6: Test evaluate with at least six expressions, one of which must be EXPR from your own ... ----



# ---- Step 7: Now write the expression ("or", True, ("and", 1/0, False)). Run it. Record the error ... ----




# ==================================================================== THE STAMP -- DO NOT EDIT
# Computed from YOUR parameters and the answer YOUR OWN code produced. Run this last, and put the
# printed line in stamp.txt.
def stamp(student_no, activity, *values):
    payload = '|'.join([str(student_no).strip(), str(activity)] + [repr(v) for v in values])
    return hashlib.sha256(payload.encode('utf-8')).hexdigest()[:10].upper()


if __name__ == '__main__':
    from logic_ops import evaluate      # the file you wrote in step 2
    print(stamp(STUDENT_NO, 1, EXPR, evaluate(EXPR)))
