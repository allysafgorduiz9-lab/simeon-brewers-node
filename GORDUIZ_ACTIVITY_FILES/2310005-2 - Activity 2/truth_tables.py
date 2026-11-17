# Activity 2 -- truth_tables.py
# Answer key for 2310005-2 (Gorduiz, Allysa F.), slip A03-2.
# Builds on Activity 1: evaluate() from logic_ops.py; fill() as taught in Lab Module 2 (L2.2).
from ast import expr
from itertools import product


import importlib


from logic_ops import evaluate
# My E1 and E2 (from my own file), translated by hand into the nested-tuple form evaluate() takes
# (not binds tightest, then and, then or, then implies):
# E1 = (p or (p and r))
# E2 = p
E1_TUPLE = ('or', 'p', ('and', 'p', 'r'))
E2_TUPLE = 'p'


# Step 1: every combination of True and False for a list of variable names.
def assignments(variables):
    return [dict(zip(variables, combo)) for combo in product([False, True], repeat=len(variables))]


def fill(expr, s):
    """Replace each variable name by its value in assignment s (Lab Module 2, L2.2).
    A name missing from s raises KeyError -- loudly, which is what we want (L2.4)."""
    if isinstance(expr, str):
        return s[expr]
    if isinstance(expr, bool):
        return expr
    return tuple([expr[0]] + [fill(x, s) for x in expr[1:]])


# Step 3: a header row, then one row per assignment.
def truth_table(expr, variables):
    print(' ' + ' '.join('%-5s' % v for v in variables) + ' | value')
    for s in assignments(variables):
        print(' ' + ' '.join('%-5s' % s[v] for v in variables) + ' | %s' % evaluate(fill(expr, s)))


# Step 5: True only when the two agree on EVERY assignment.
def equivalent(expr1, expr2, variables):
    return all(evaluate(fill(expr1, s)) == evaluate(fill(expr2, s)) for s in assignments(variables))


# The fourth function (objective 4): name a tautology / contradiction automatically.
def classify(expr, variables):
    values = [evaluate(fill(expr, s)) for s in assignments(variables)]
    if all(values):
        return 'tautology'
    if not any(values):
        return 'contradiction'
    return 'contingency'


def witness(expr1, expr2, variables):
    """Step 8: the first assignment where they differ, as "x=False,y=True" (names in alphabetical
    order) -- or "none" when they are equivalent."""
    for s in assignments(variables):
        if evaluate(fill(expr1, s)) != evaluate(fill(expr2, s)):
            return ','.join('%s=%s' % (v, s[v]) for v in sorted(variables))
    return 'none'


# The step 9 FIX: never trust a variable list that might be incomplete -- take every variable that
# appears in EITHER expression.
def variables_of(expr):
    if isinstance(expr, str):
        return {expr}
    if isinstance(expr, bool):
        return set()
    return set().union(*(variables_of(x) for x in expr[1:]))

def equivalent_complete(expr1, expr2):
    names = sorted(variables_of(expr1) | variables_of(expr2))
    return equivalent(expr1, expr2, names)


if __name__ == '__main__':
    print('STEP 2 -- the count is 2 to the power n')
    for n in (1, 2, 3, 4):
        names = ['v%d' % i for i in range(n)]
        print(' n = %d: %d rows (2^%d = %d)' % (n, len(assignments(names)), n, 2 ** n))
    print()
    print('STEP 4 -- p or not p')
    truth_table(('or', 'p', ('not', 'p')), ['p'])
    print(' ->', classify(('or', 'p', ('not', 'p')), ['p']), '(true on every row)')
    print('STEP 4 -- p and not p')
    truth_table(('and', 'p', ('not', 'p')), ['p'])
    print(' ->', classify(('and', 'p', ('not', 'p')), ['p']), '(false on every row)')
    print()
    dm1, dm2 = ('not', ('and', 'p', 'q')), ('or', ('not', 'p'), ('not', 'q'))
    print('STEP 6 -- De Morgan: not (p and q)')
    truth_table(dm1, ['p', 'q'])
    print('STEP 6 -- (not p) or (not q)')
    truth_table(dm2, ['p', 'q'])
    print(' equivalent:', equivalent(dm1, dm2, ['p', 'q']))
    print()
    im1, im2 = ('implies', 'p', 'q'), ('or', ('not', 'p'), 'q')
    print('STEP 7 -- p implies q')
    truth_table(im1, ['p', 'q'])
    print('STEP 7 -- not p or q')
    truth_table(im2, ['p', 'q'])
    print(' equivalent:', equivalent(im1, im2, ['p', 'q']))
    print()
    P = importlib.import_module('IT405_A02_2310005-2') # my own file, not retyped
    # The differing row names only the variables my two expressions USE (the step 9 lesson);
    # my VARIABLES list may also name one that neither expression uses.
    names = sorted(variables_of(E1_TUPLE) | variables_of(E2_TUPLE))
    print('STEP 8 -- my own E1 = %s and E2 = %s over %s' % (P.E1, P.E2, names))
    if names != sorted(P.VARIABLES):
        print(' (my VARIABLES list is %s; the extra name is used by neither expression)' % (P.VARIABLES,))
    print('E1:')
    truth_table(E1_TUPLE, names)
    print('E2:')
    truth_table(E2_TUPLE, names)
    print(' equivalent:', equivalent(E1_TUPLE, E2_TUPLE, names),
        '| differing row:', witness(E1_TUPLE, E2_TUPLE, names))
    if names != sorted(P.VARIABLES):
        print(' over the whole VARIABLES list the same row reads', witness(E1_TUPLE, E2_TUPLE, P.VARIABLES),
            '-- also a correct answer; its stamp is accepted too')
    print()
    a, b = ('or', 'p', 'q'), ('or', 'p', ('or', 'q', 'r'))
    print('STEP 9 -- equivalent(%s, %s, [p, q]) -- the second expression also uses r' % (a, b))
    try:
        print(' ->', equivalent(a, b, ['p', 'q']))
    except KeyError as e:
        print(' -> KeyError: %s (r was never given a value, so the checker cannot answer)' % e)
    print(' with the fix, over every variable of both (p, q, r):', equivalent_complete(a, b),
        '| differing row:', witness(a, b, sorted(variables_of(a) | variables_of(b))))
