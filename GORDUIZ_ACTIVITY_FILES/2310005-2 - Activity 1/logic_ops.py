# Activity 1 -- logic_ops.py
# Answer key for 2310005-2 (Gorduiz, Allysa F.), slip A03-2.
# Steps 2-3: the four operators are built from comparisons only -- no and / or / not inside them.
import sys
import traceback


def my_and(a, b):
    """True only when both are True."""
    return (a, b) == (True, True)


def my_or(a, b):
    """False only when both are False."""
    return (a, b) != (False, False)


def my_not(a):
    """The opposite truth value."""
    return a == False # noqa: E712 -- a comparison, on purpose (step 2)

def my_implies(a, b):
    """'a implies b' is False only when a is True and b is False.
    On paper (step 3): T T -> True T F -> False F T -> True F F -> True"""
    return (a, b) != (True, False)


# Step 5: evaluate a nested tuple by calling my own four functions.
def evaluate(expr):
    if isinstance(expr, bool):
        return expr
    op = expr[0]
    if op == 'not':
        return my_not(evaluate(expr[1]))
    left, right = evaluate(expr[1]), evaluate(expr[2])
    if op == 'and':
        return my_and(left, right)
    if op == 'or':
        return my_or(left, right)
    if op == 'implies':
        return my_implies(left, right)
    raise ValueError('unknown operator: %r' % (op,))

if __name__ == '__main__':
    import importlib
    # My own file's name has hyphens, so "import IT405_A01_2310005-2" is a SyntaxError; this loads it instead.
    # Only its parameters load -- its stamp line runs only when the file itself is run.
    P = importlib.import_module('IT405_A01_2310005-2')
    EXPR, EXPR_TEXT = P.EXPR, P.EXPR_TEXT # from my own file -- not retyped

    print('STEP 1 -- Python version on this computer:', sys.version.split()[0])
    print()
    print('STEP 4 -- every function on every combination (compare with the paper table)')
    for a in (True, False):
        print(' my_not(%-5s) = %s' % (a, my_not(a)))
    for name, f in (('my_and', my_and), ('my_or', my_or), ('my_implies', my_implies)):
        for a in (True, False):
            for b in (True, False):
                print(' %s(%-5s, %-5s) = %s' % (name, a, b, f(a, b)))
    print()
    print('STEP 6 -- evaluate on six expressions (the last one is EXPR from my own file)')
    tests = [
        (('and', True, ('not', False)), True),
        (('or', False, False), False),
        (('implies', True, False), False),
        (('implies', False, False), True),
        (('not', ('and', True, ('or', False, True))), False),
        (EXPR, False),
    ]
    for expr, by_hand in tests:
        got = evaluate(expr)
        print(' evaluate(%s) = %s (by hand: %s) %s' % (expr, got, by_hand, 'OK' if got == by_hand else
'DIFFERENT'))
    print(' EXPR written out:', EXPR_TEXT)
    print()
    print('STEP 7 -- ("or", True, ("and", 1/0, False))')
    try:
        expr = ('or', True, ('and', 1 / 0, False))
        print(' evaluate ->', evaluate(expr))
    except ZeroDivisionError:
        print(' The error exactly as Python reports it:')
        print(' ' + traceback.format_exc().strip().replace('\n', '\n '))