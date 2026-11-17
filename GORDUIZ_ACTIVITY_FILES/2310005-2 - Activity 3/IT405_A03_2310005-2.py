# -*- coding: utf-8 -*-
"""IT 405L  --  LABORATORY ACTIVITY 3
A Rule Engine -- Facts, Rules, Queries and Backward Chaining

    Gorduiz, Allysa F.
    2310005-2        slip A03-2        Section A        Group A03

THE VALUES BELOW ARE YOURS ALONE. A classmate may help you understand the work; a classmate
cannot answer it for you, because their answer belongs to their parameters, not to yours.

HOW TO USE THIS FILE
    1. Keep it in the same folder as the code you write. Your activity sheet names that file.
    2. Write your code there, following the steps on your sheet. The markers below are for your
       own notes.
    3. Run THIS file last:   python IT405_A03_2310005-2.py
       It imports your code, computes your stamp and prints one line. Put that line in stamp.txt.

Until you have written the function named at the bottom of this file, running it reports
ModuleNotFoundError or NameError. That is expected -- there is nothing to import yet.

It needs nothing but Python: no internet, no administrator rights and no installation, so it
behaves the same on a laboratory computer, on a borrowed laptop and on your own machine.
"""
import hashlib


# ==================================================================== YOUR PARAMETERS
STUDENT_NO = '2310005-2'

# Your eight family facts.
FACTS = [
    ('carl', 'jom'),
    ('carl', 'luis'),
    ('carl', 'kira'),
    ('carl', 'ivy'),
    ('carl', 'ben'),
    ('ben', 'dina'),
    ('dina', 'uma'),
    ('dina', 'nico'),
]

# The fact step 8 adds.
STEP8 = ('ben', 'ben')


# ==================================================================== YOUR WORK

# ---- Step 1: Represent a fact as a tuple, for example ("parent", "ana", "ben"). Use the eight ... ----



# ---- Step 2: Write matches(pattern, fact) that returns a dictionary of variable bindings, or None. ... ----



# ---- Step 3: Test matches with ("parent", "X", "ben") against your facts. It should bind X to ... ----



# ---- Step 4: Represent a rule as a head and a list of conditions, for example head ("grandparent", ... ----



# ---- Step 5: Write query(goal) that returns every set of bindings satisfying the goal, trying ... ----



# ---- Step 6: Ask for all grandparents. Check the answers by hand against your fact list. ----



# ---- Step 7: Add a rule for ancestor that refers to itself: an ancestor is a parent, or a parent ... ----



# ---- Step 8: Now add STEP8 from your own file and run the ancestor query again. Record exactly ... ----




# ==================================================================== THE STAMP -- DO NOT EDIT
# Computed from YOUR parameters and the answer YOUR OWN code produced. Run this last, and put the
# printed line in stamp.txt.
def stamp(student_no, activity, *values):
    payload = '|'.join([str(student_no).strip(), str(activity)] + [repr(v) for v in values])
    return hashlib.sha256(payload.encode('utf-8')).hexdigest()[:10].upper()


if __name__ == '__main__':
    # grandparents -> every grandparent your engine finds, as a tuple of
    #                 (older, younger) tuples, sorted alphabetically.
    grandparents = (('ben', 'nico'), ('ben', 'uma'), ('carl', 'dina')) # what my query() returned, sorted
     # <- replace with what your code returned
    print(stamp(STUDENT_NO, 3, tuple(tuple(f) for f in FACTS), grandparents))
