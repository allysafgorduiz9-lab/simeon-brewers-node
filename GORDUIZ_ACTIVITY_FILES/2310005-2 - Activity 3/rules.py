# Activity 3 -- rules.py
# Answer key for 2310005-2 (Gorduiz, Allysa F.), slip A03-2.
# A backward-chaining rule engine, built the way Lab Module 3 teaches it (L3.1-L3.5).
import importlib
import itertools

# Step 1: my eight facts, loaded from my own file (not retyped) and written as ("parent", older, younger).
# The file's name has hyphens, so "import IT405_A03_2310005-2" is a SyntaxError; this loads it instead.
P = importlib.import_module('IT405_A03_2310005-2')
FACTS = [('parent', older, younger) for older, younger in P.FACTS]
STEP8 = ('parent',) + tuple(P.STEP8) # ('parent', 'ben', 'ben')

# Step 4 and step 7: a rule is (head, [conditions]).
RULES = [
    (('grandparent', 'X', 'Z'), [('parent', 'X', 'Y'), ('parent', 'Y', 'Z')]),
    # an ancestor is a parent, or a parent of an ancestor
    (('ancestor', 'X', 'Z'), [('parent', 'X', 'Z')]),
    (('ancestor', 'X', 'Z'), [('parent', 'X', 'Y'), ('ancestor', 'Y', 'Z')]),
]

DEPTH_LIMIT = 60 # L3.5: turns endless recursion into a clear failure



def is_var(t):
    return isinstance(t, str) and t[:1].isupper()


def walk(t, b):
    while is_var(t) and t in b:
        t = b[t]
    return t


def unify(x, y, bindings):
    """L3.2: a NEW bindings dict on success, None on failure. Starts from a copy."""
    if len(x) != len(y):
        return None
    b = dict(bindings)
    for s, t in zip(x, y):
        s, t = walk(s, b), walk(t, b)
        if s == t:
            continue
        if is_var(s):
            b[s] = t
        elif is_var(t):
            b[t] = s
        else:
            return None
    return b


# Step 2: a dictionary of bindings, or None. {} (empty) means "matched, nothing to bind" -- NOT failure.
def matches(pattern, fact):
    return unify(pattern, fact, {})
 
 
_fresh = itertools.count(1)


def _rename(rule):
    """Each use of a rule gets its own copies of X, Y, Z, so they never clash with the goal's."""
    n = next(_fresh)
    r = lambda term: tuple('%s_%d' % (t, n) if is_var(t) else t for t in term)
    head, body = rule
    return r(head), [r(g) for g in body]


def _solve(goals, b, depth, facts):
    if not goals:
        yield b
        return
    if depth > DEPTH_LIMIT:
        raise RuntimeError('depth bound of %d rule steps reached -- the search keeps going deeper '
                        'without the goal getting smaller' % DEPTH_LIMIT)
    first, rest = goals[0], goals[1:]
    for fact in facts: # facts first ...
        nb = unify(first, fact, b)
        if nb is not None: # L3.3: "is not None", never truthiness
            yield from _solve(rest, nb, depth, facts)
    for rule in RULES: # ... then rules
        head, body = _rename(rule)
        nb = unify(first, head, b)
        if nb is not None:
            yield from _solve(body + rest, nb, depth + 1, facts)



# Step 5: every set of bindings that satisfies the goal (each answer once).
def query(goal, facts=None):
    answers = []
    for b in _solve([goal], {}, 0, FACTS if facts is None else facts):
        ans = {v: walk(v, b) for v in goal if is_var(v)}
        if ans not in answers:
            answers.append(ans)
    return answers


def pairs(answers, a='X', b='Z'):
    return sorted((x[a], x[b]) for x in answers)


if __name__ == '__main__':
    print('FACTS:')
    for f in FACTS:
        print(' %s(%s, %s).' % f)
    print('RULES:')
    print(' grandparent(X, Z) :- parent(X, Y), parent(Y, Z).')
    print(' ancestor(X, Z) :- parent(X, Z).')
    print(' ancestor(X, Z) :- parent(X, Y), ancestor(Y, Z).')
    print()
    print('STEP 3 -- matches(("parent", "X", "ben"), fact) on every fact:')
    found = [m for m in (matches(('parent', 'X', 'ben'), f) for f in FACTS) if m is not None]
    print(' ', found if found else 'no match: ben is not in my facts, so no fact binds X (None every time)')
    child = FACTS[4][2]
    print(' the same test with a child who IS in my facts, ("parent", "X", "%s"):' % child,
        [m for m in (matches(('parent', 'X', child), f) for f in FACTS) if m is not None])
    print(' a match that binds nothing:', matches(FACTS[0], FACTS[0]),
        '-- {} is a SUCCESS, not a failure')
    print()
    gp = pairs(query(('grandparent', 'X', 'Z')))
    print('STEP 6 -- grandparents (%d):' % len(gp))
    for x, z in gp:
        print(' grandparent(%s, %s)' % (x, z))
    print()
    anc = pairs(query(('ancestor', 'X', 'Z')))
    print('STEP 7 -- ancestors (%d):' % len(anc))
    for x, z in anc:
        print(' ancestor(%s, %s)' % (x, z))
    print()
    print('STEP 8 -- add %s(%s, %s) and ask for all ancestors again:' % STEP8)
    try:
        query(('ancestor', 'X', 'Z'), FACTS + [STEP8])
        print(' finished (unexpected)')
    except RuntimeError as e:
        print(' RuntimeError:', e)
    import sys
    old = sys.getrecursionlimit()
    try: # the same query with NO depth bound
        globals()['DEPTH_LIMIT'] = 10 ** 9
        query(('ancestor', 'X', 'Z'), FACTS + [STEP8])
    except RecursionError as e:
        print(' without the depth bound -> RecursionError:', e)
    finally:
        globals()['DEPTH_LIMIT'] = 60
        sys.setrecursionlimit(old)
