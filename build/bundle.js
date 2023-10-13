
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    let src_url_equal_anchor;
    function src_url_equal(element_src, url) {
        if (!src_url_equal_anchor) {
            src_url_equal_anchor = document.createElement('a');
        }
        src_url_equal_anchor.href = url;
        return element_src === src_url_equal_anchor.href;
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function validate_store(store, name) {
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot_base(slot, slot_definition, ctx, $$scope, slot_changes, get_slot_context_fn) {
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function get_all_dirty_from_scope($$scope) {
        if ($$scope.ctx.length > 32) {
            const dirty = [];
            const length = $$scope.ctx.length / 32;
            for (let i = 0; i < length; i++) {
                dirty[i] = -1;
            }
            return dirty;
        }
        return -1;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_style(node, key, value, important) {
        if (value === null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail, { cancelable = false } = {}) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail, { cancelable });
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
                return !event.defaultPrevented;
            }
            return true;
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    function destroy_block(block, lookup) {
        block.d(1);
        lookup.delete(block.key);
    }
    function outro_and_destroy_block(block, lookup) {
        transition_out(block, 1, 1, () => {
            lookup.delete(block.key);
        });
    }
    function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
        let o = old_blocks.length;
        let n = list.length;
        let i = o;
        const old_indexes = {};
        while (i--)
            old_indexes[old_blocks[i].key] = i;
        const new_blocks = [];
        const new_lookup = new Map();
        const deltas = new Map();
        i = n;
        while (i--) {
            const child_ctx = get_context(ctx, list, i);
            const key = get_key(child_ctx);
            let block = lookup.get(key);
            if (!block) {
                block = create_each_block(key, child_ctx);
                block.c();
            }
            else if (dynamic) {
                block.p(child_ctx, dirty);
            }
            new_lookup.set(key, new_blocks[i] = block);
            if (key in old_indexes)
                deltas.set(key, Math.abs(i - old_indexes[key]));
        }
        const will_move = new Set();
        const did_move = new Set();
        function insert(block) {
            transition_in(block, 1);
            block.m(node, next);
            lookup.set(block.key, block);
            next = block.first;
            n--;
        }
        while (o && n) {
            const new_block = new_blocks[n - 1];
            const old_block = old_blocks[o - 1];
            const new_key = new_block.key;
            const old_key = old_block.key;
            if (new_block === old_block) {
                // do nothing
                next = new_block.first;
                o--;
                n--;
            }
            else if (!new_lookup.has(old_key)) {
                // remove old block
                destroy(old_block, lookup);
                o--;
            }
            else if (!lookup.has(new_key) || will_move.has(new_key)) {
                insert(new_block);
            }
            else if (did_move.has(old_key)) {
                o--;
            }
            else if (deltas.get(new_key) > deltas.get(old_key)) {
                did_move.add(new_key);
                insert(new_block);
            }
            else {
                will_move.add(old_key);
                o--;
            }
        }
        while (o--) {
            const old_block = old_blocks[o];
            if (!new_lookup.has(old_block.key))
                destroy(old_block, lookup);
        }
        while (n)
            insert(new_blocks[n - 1]);
        return new_blocks;
    }
    function validate_each_keys(ctx, list, get_context, get_key) {
        const keys = new Set();
        for (let i = 0; i < list.length; i++) {
            const key = get_key(get_context(ctx, list, i));
            if (keys.has(key)) {
                throw new Error('Cannot have duplicate keys in a keyed each');
            }
            keys.add(key);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.48.0' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src/components/Background.svelte generated by Svelte v3.48.0 */

    const file$n = "src/components/Background.svelte";

    function create_fragment$o(ctx) {
    	let div;
    	let ul;
    	let li0;
    	let t0;
    	let li1;
    	let t1;
    	let li2;
    	let t2;
    	let li3;
    	let t3;
    	let li4;
    	let t4;
    	let li5;

    	const block = {
    		c: function create() {
    			div = element("div");
    			ul = element("ul");
    			li0 = element("li");
    			t0 = space();
    			li1 = element("li");
    			t1 = space();
    			li2 = element("li");
    			t2 = space();
    			li3 = element("li");
    			t3 = space();
    			li4 = element("li");
    			t4 = space();
    			li5 = element("li");
    			attr_dev(li0, "class", "svelte-dxw7lp");
    			add_location(li0, file$n, 2, 8, 63);
    			attr_dev(li1, "class", "svelte-dxw7lp");
    			add_location(li1, file$n, 3, 8, 81);
    			attr_dev(li2, "class", "svelte-dxw7lp");
    			add_location(li2, file$n, 4, 8, 99);
    			attr_dev(li3, "class", "svelte-dxw7lp");
    			add_location(li3, file$n, 5, 8, 117);
    			attr_dev(li4, "class", "svelte-dxw7lp");
    			add_location(li4, file$n, 6, 8, 135);
    			attr_dev(li5, "class", "svelte-dxw7lp");
    			add_location(li5, file$n, 7, 8, 153);
    			attr_dev(ul, "class", "box-area svelte-dxw7lp");
    			add_location(ul, file$n, 1, 4, 33);
    			attr_dev(div, "class", "animation-area svelte-dxw7lp");
    			add_location(div, file$n, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, ul);
    			append_dev(ul, li0);
    			append_dev(ul, t0);
    			append_dev(ul, li1);
    			append_dev(ul, t1);
    			append_dev(ul, li2);
    			append_dev(ul, t2);
    			append_dev(ul, li3);
    			append_dev(ul, t3);
    			append_dev(ul, li4);
    			append_dev(ul, t4);
    			append_dev(ul, li5);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$o.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$o($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Background', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Background> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Background extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$o, create_fragment$o, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Background",
    			options,
    			id: create_fragment$o.name
    		});
    	}
    }

    /* src/components/Tabs.svelte generated by Svelte v3.48.0 */
    const file$m = "src/components/Tabs.svelte";

    function get_each_context$8(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[4] = list[i];
    	return child_ctx;
    }

    // (21:8) {#each items as item (item.name)}
    function create_each_block$8(key_1, ctx) {
    	let li;
    	let i;
    	let i_class_value;
    	let t0;
    	let span;
    	let t1_value = /*item*/ ctx[4].pageTitle + "";
    	let t1;
    	let t2;
    	let mounted;
    	let dispose;

    	function click_handler() {
    		return /*click_handler*/ ctx[2](/*item*/ ctx[4]);
    	}

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			li = element("li");
    			i = element("i");
    			t0 = space();
    			span = element("span");
    			t1 = text(t1_value);
    			t2 = space();
    			attr_dev(i, "class", i_class_value = "mdi mdi-24px " + /*item*/ ctx[4].icon + " text-color" + " svelte-11href6");
    			add_location(i, file$m, 22, 16, 525);
    			add_location(span, file$m, 23, 16, 593);
    			attr_dev(li, "class", "svelte-11href6");
    			toggle_class(li, "active", /*item*/ ctx[4].active);
    			add_location(li, file$m, 21, 12, 437);
    			this.first = li;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			append_dev(li, i);
    			append_dev(li, t0);
    			append_dev(li, span);
    			append_dev(span, t1);
    			append_dev(li, t2);

    			if (!mounted) {
    				dispose = listen_dev(li, "click", click_handler, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty & /*items*/ 1 && i_class_value !== (i_class_value = "mdi mdi-24px " + /*item*/ ctx[4].icon + " text-color" + " svelte-11href6")) {
    				attr_dev(i, "class", i_class_value);
    			}

    			if (dirty & /*items*/ 1 && t1_value !== (t1_value = /*item*/ ctx[4].pageTitle + "")) set_data_dev(t1, t1_value);

    			if (dirty & /*items*/ 1) {
    				toggle_class(li, "active", /*item*/ ctx[4].active);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$8.name,
    		type: "each",
    		source: "(21:8) {#each items as item (item.name)}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$n(ctx) {
    	let div;
    	let ul;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let each_value = /*items*/ ctx[0];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*item*/ ctx[4].name;
    	validate_each_keys(ctx, each_value, get_each_context$8, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context$8(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block$8(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(ul, "class", "uppercase svelte-11href6");
    			add_location(ul, file$m, 19, 4, 360);
    			attr_dev(div, "class", "tabs svelte-11href6");
    			add_location(div, file$m, 18, 0, 337);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, ul);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*items, handleClick*/ 3) {
    				each_value = /*items*/ ctx[0];
    				validate_each_argument(each_value);
    				validate_each_keys(ctx, each_value, get_each_context$8, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, ul, destroy_block, create_each_block$8, null, get_each_context$8);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$n.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$n($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Tabs', slots, []);
    	let { items = [] } = $$props;
    	const dispatch = createEventDispatcher();

    	const handleClick = tabName => {
    		dispatch('tabChange', tabName);
    		document.getElementById('drawer-anchor').scrollIntoView({ behavior: 'smooth', block: 'start' });
    	};

    	const writable_props = ['items'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Tabs> was created with unknown prop '${key}'`);
    	});

    	const click_handler = item => handleClick(item.name);

    	$$self.$$set = $$props => {
    		if ('items' in $$props) $$invalidate(0, items = $$props.items);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		items,
    		dispatch,
    		handleClick
    	});

    	$$self.$inject_state = $$props => {
    		if ('items' in $$props) $$invalidate(0, items = $$props.items);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [items, handleClick, click_handler];
    }

    class Tabs extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$n, create_fragment$n, safe_not_equal, { items: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Tabs",
    			options,
    			id: create_fragment$n.name
    		});
    	}

    	get items() {
    		throw new Error("<Tabs>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set items(value) {
    		throw new Error("<Tabs>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    var about = {
      name: 'about', // do not change
      pageTitle: 'About',
      icon: 'mdi-account-cowboy-hat',

      greeting: 'Hi, my name is James Larson',
      description: 'I recently graduated from Cornell University with a Bachelor\'s degree in Computer Science and a Minor in Business Management. I am currently applying to software engineering positions primarily in New York City and the San Francisco Bay Area. I can be reached via email at james@jamesxlarson.com.',
      birthYear: '2000',
      residence: 'New York, NY',
      freelance: 'james@jamesxlarson.com',
      address: 'linkedin.com/in/jameslarsonm',
      quote: '',
      hobbies: [
        {
          title: 'Board Games',
          icon: 'mdi-chess-rook',
          description: 'I enjoy playing chess and other board/card games in my free time. I am currently rated 1600 on chess.com, which places me in the top 1.5% of players under rapid time controls.'
        },
        {
          title: 'Sports',
          icon: 'mdi-football',
          description: 'I previously played football and lacrosse. I also enjoy golf and I have multiple scuba diving and sailing cerifications.'
        },
        {
          title: 'Outdoors',
          icon: 'mdi-music',
          description: 'I have played the violin for over 10 years and I am currently learning how to play the piano.'
        },
      ]
    };

    var resume = {
      name: 'resume', // do not change
      pageTitle: 'Resume',
      icon: 'mdi-card-account-details',

      experience: {
        title: 'Experience',
        icon: 'mdi-tie',
        data: [
          {
            title: 'Software Engineer',
            start: '02/2023',
            end: 'Present',
            company: 'Stealth Startup',
            description: 'I launched a fintech startup with the aim of revolutionizing shareholder voting practices through a custom application. Our tech stack that includes Node.js, React.js, TypeScript, MongoDB, Docker, Kubernetes, and the Plaid API. I am prohibited from sharing additional details because of an NDA agreement. Upon accepting a full-time offer I will no longer be significantly involved in this startup.'
          },
          {
            title: 'ChatGPT Prompt Engineer',
            start: '12/2022',
            end: 'present',
            company: 'Independent',
            description: 'As an independent ChatGPT Prompt Engineer, I specialize in optimizing and personalizing prompts for businesses and individuals using OpenAI\'s ChatGPT, guaranteeing a minimum of 20% conversion rate improvement.'
          },
          {
            title: 'Software and Security Engineer',
            start: '07/2020',
            end: '08/2021',
            company: 'Larson Natural Health Center',
            description: 'I spearheaded the development of an efficient medical inventory management system and designed an advanced Patient Feedback System. My efforts led to significant improvements in operational efficiency and reduced response times to patient concerns by over 50%.'
          },
        ]
      },
      education: {
        title: 'Education',
        icon: 'mdi-school',
        data: [
          {
            major: 'Computer Science',
            start: '08/2019',
            end: '05/2023',
            institute: 'Cornell University',
            description: 'I recently graduated from Cornell University with a Bachelor\'s degree in Computer Science and a Minor in Business Management.'
          },
        ]
      },
      certificatesAndAwards: {
        title: 'Certificates/Awards',
        icon: 'mdi-medal',
        data: [
          {
            title: 'Cornell FinTech Avalanche Hackathon',
            date: '05/2022',
            issuedBy: 'Cornell University',
            description: 'My team faced the challenge of creating an application that utilized blockchain technologies in an unprecedented way within a tight 2-day timeframe. In this fast-paced environment, we were able to engineer a virtual card game leveraging Java, TypeScript, and Solidity. Our project was recognized as the "Best Advanced Hack," an award given for the most technically challenging project in terms of scope and implementation. This accolade, along with finishing 2nd place overall, earned my team a combined prize of $2,750.'
          },

        ]
      },
      academic: {
        title: 'Technical Skills',
        icon: 'mdi-library-shelves',
        data: [
          {
            title: 'Java, Python, C, JavaScript, TypeScript, HTML, CSS, SQL, Solidity, OCaml, Go, Ruby',
            date: 'Languages',
            issuedBy: 'Other',
            description: 'Node.js | MySQL | PostgreSQL | MongoDB | Flask | RESTful APIs | Ruby on Rails | Agile Development | Git | GitHub | Linux/Unix | Pandas | AWS | Docker | Kubernetes | NumPy | LLM Prompt Engineering | CI/CD pipelines | Gradle | Redux | OOP'
          },
        ]
      },
      // skills: [
      //   {
      //     title: 'Swinging',
      //     barType: 'line',
      //     icon: 'mdi-web',
      //     items: [
      //       {
      //         title: 'Horizontally',
      //         level: 80
      //       },
      //       {
      //         title: 'Vertically',
      //         level: 90
      //       },
      //     ]
      //   },
      //   {
      //     title: 'Design',
      //     barType: 'line',
      //     icon: 'mdi-brush-variant',
      //     items: [
      //       {
      //         title: 'Web Design',
      //         level: 85
      //       },
      //       {
      //         title: 'Photoshop',
      //         level: 90
      //       },
      //       {
      //         title: 'After Effects',
      //         level: 80
      //       },
      //     ]
      //   },
        // {
        //   title: 'Languages',
        //   barType: 'dots',
        //   icon: 'mdi-earth',
        //   items: [
        //     {
        //       title: 'Albanian',
        //       level: 100
        //     },
        //     {
        //       title: 'English',
        //       level: 94
        //     },
        //   ]
        // },
        // {
        //   title: 'Knowledge',
        //   barType: 'dots',
        //   icon: 'mdi-book-open-page-variant',
        //   items: [
        //     {
        //       title: 'Web shoot',
        //       level: 94
        //     },
        //     {
        //       title: 'Taking pictures',
        //       level: 91
        //     },
        //   ]
        // }
      // ],
    };

    var services = {
      name: 'services', // do not change
      pageTitle: 'Projects',
      header: 'Notable Projects',
      icon: 'mdi-monitor-shimmer',

      footer: 'Notable Projects',
      products: [
        {
          title: 'Coming Soon',
          icon: 'mdi-webpack',
          description: 'This part of the site is still under development. Thank you for your patience.'
        },
        // {
        //   title: 'Taking pictures',
        //   icon: 'mdi-desktop-mac',
        //   description: 'Delivering high-end and superb pictures of myself in all different locations.'
        // }
      ]
    };

    var contact = {
      name: 'contact', // do not change
      pageTitle: 'Contact',
      header: 'I prefer to be contacted via email. Thank you.',
      icon: 'mdi-send',

      mapsIframe: '<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d96708.35377226779!2d-74.05163198674386!3d40.75903219740497!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x89c2588f046ee661%3A0xa0b3281fcecc08c!2sManhattan%2C%20New%20York%2C%20NY!5e0!3m2!1sen!2sus!4v1697153575321!5m2!1sen!2sus" width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>',
      address: 'Manhattan, NY',
      hours: '9AM - 5PM',
      email: 'james@jamesxlarson.com',
      tel: '+1 941 404 9703'
    };

    var subpages = [
      about,
      resume,
      services,
      contact
    ];

    const favicon = '';
    const title = 'James Larson | Personal Page';
    const meta = [
      {
        name: 'description',
        content: 'James Larson\'s personal website. James Larson is a software engineer and recent graduate of Cornell University.'
      },
      {
        name: 'keywords',
        content: 'james,larson,personal,site,developer,software,web,desktop,mobile,fast,reliable,resume'
      }
    ];
    const landingPage = 'about';

    const items = subpages.map(
      page => ({
        active: page.name === landingPage,
        ...page
      })
    );

    const TabStore = writable([...items]);

    /* src/components/Header.svelte generated by Svelte v3.48.0 */
    const file$l = "src/components/Header.svelte";

    function create_fragment$m(ctx) {
    	let div;
    	let tabs;
    	let current;

    	tabs = new Tabs({
    			props: { items: /*$TabStore*/ ctx[0] },
    			$$inline: true
    		});

    	tabs.$on("tabChange", /*handleTabChange*/ ctx[1]);

    	const block = {
    		c: function create() {
    			div = element("div");
    			create_component(tabs.$$.fragment);
    			attr_dev(div, "class", "grid-item-header mt-2 svelte-y17zse");
    			add_location(div, file$l, 19, 0, 373);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(tabs, div, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const tabs_changes = {};
    			if (dirty & /*$TabStore*/ 1) tabs_changes.items = /*$TabStore*/ ctx[0];
    			tabs.$set(tabs_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(tabs.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(tabs.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(tabs);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$m.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$m($$self, $$props, $$invalidate) {
    	let $TabStore;
    	validate_store(TabStore, 'TabStore');
    	component_subscribe($$self, TabStore, $$value => $$invalidate(0, $TabStore = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Header', slots, []);

    	const handleTabChange = e => {
    		const name = e.detail;

    		TabStore.update(tabItems => {
    			let clonedTabs = [...tabItems];

    			clonedTabs.forEach(tab => {
    				tab.active = tab.name === name;
    			});

    			return clonedTabs;
    		});
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Header> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		Tabs,
    		TabStore,
    		handleTabChange,
    		$TabStore
    	});

    	return [$TabStore, handleTabChange];
    }

    class Header extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$m, create_fragment$m, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Header",
    			options,
    			id: create_fragment$m.name
    		});
    	}
    }

    var card = {
      coverImage: 'https://i.pinimg.com/originals/5e/66/18/5e6618a423dbc370f695a947842724ef.jpg',
      profileImage: 'https://drive.google.com/uc?export=view&id=1OEZTPeq49r6dOrYSa8JZU5CugIZH_r_R',
      fullName: 'James Larson',
      profession: 'Software Engineer - Cornell University \'23',
      cv: {
        url: 'https://drive.google.com/file/d/1wO31OB2-eirGDCM1vICQDHzlPAghFkgz/view?usp=sharing',
        icon: 'mdi-download'
      },
      email: {
        address: 'james@jamesxlarson.com',
        icon: 'mdi-email-send'
      },
      links: [
        {
          title: 'Github',
          url: 'https://github.com/JamesLarson8',
          icon: 'mdi-github'
        },
        {
          title: 'Linkedin',
          url: 'https://www.linkedin.com/in/jameslarsonm',
          icon: 'mdi-linkedin'
        }
        ,
        {
          title: 'chess.com',
          url: 'https://www.chess.com/member/james824',
          icon: 'mdi-chess-pawn'
        },
        // {
        //   title: 'Play Store',
        //   url: '#',
        //   icon: 'mdi-google-play'
        // }
      ]
    };

    /* src/components/pages/Card/Links.svelte generated by Svelte v3.48.0 */

    const file$k = "src/components/pages/Card/Links.svelte";

    function get_each_context$7(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[1] = list[i];
    	return child_ctx;
    }

    // (6:4) {#each links as link}
    function create_each_block$7(ctx) {
    	let a;
    	let i;
    	let i_class_value;
    	let t;
    	let a_href_value;

    	const block = {
    		c: function create() {
    			a = element("a");
    			i = element("i");
    			t = space();
    			attr_dev(i, "class", i_class_value = "mdi mdi-24px " + /*link*/ ctx[1].icon + " text-color" + " svelte-nrf3kx");
    			add_location(i, file$k, 7, 16, 179);
    			attr_dev(a, "class", "mr-1 svelte-nrf3kx");
    			attr_dev(a, "href", a_href_value = /*link*/ ctx[1].url);
    			attr_dev(a, "target", "_blank");
    			add_location(a, file$k, 6, 12, 114);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);
    			append_dev(a, i);
    			append_dev(a, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*links*/ 1 && i_class_value !== (i_class_value = "mdi mdi-24px " + /*link*/ ctx[1].icon + " text-color" + " svelte-nrf3kx")) {
    				attr_dev(i, "class", i_class_value);
    			}

    			if (dirty & /*links*/ 1 && a_href_value !== (a_href_value = /*link*/ ctx[1].url)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$7.name,
    		type: "each",
    		source: "(6:4) {#each links as link}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$l(ctx) {
    	let ul;
    	let each_value = /*links*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$7(get_each_context$7(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(ul, "class", "social-media mt-1 svelte-nrf3kx");
    			add_location(ul, file$k, 4, 0, 45);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, ul, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*links*/ 1) {
    				each_value = /*links*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$7(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$7(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(ul, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(ul);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$l.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$l($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Links', slots, []);
    	let { links = [] } = $$props;
    	const writable_props = ['links'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Links> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('links' in $$props) $$invalidate(0, links = $$props.links);
    	};

    	$$self.$capture_state = () => ({ links });

    	$$self.$inject_state = $$props => {
    		if ('links' in $$props) $$invalidate(0, links = $$props.links);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [links];
    }

    class Links extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$l, create_fragment$l, safe_not_equal, { links: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Links",
    			options,
    			id: create_fragment$l.name
    		});
    	}

    	get links() {
    		throw new Error("<Links>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set links(value) {
    		throw new Error("<Links>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/pages/Card/Footer.svelte generated by Svelte v3.48.0 */

    const file$j = "src/components/pages/Card/Footer.svelte";

    function create_fragment$k(ctx) {
    	let div1;
    	let button0;
    	let span0;
    	let t1;
    	let i0;
    	let i0_class_value;
    	let t2;
    	let div0;
    	let t3;
    	let button1;
    	let span1;
    	let t5;
    	let i1;
    	let i1_class_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			button0 = element("button");
    			span0 = element("span");
    			span0.textContent = "CV";
    			t1 = space();
    			i0 = element("i");
    			t2 = space();
    			div0 = element("div");
    			t3 = space();
    			button1 = element("button");
    			span1 = element("span");
    			span1.textContent = "e-mail";
    			t5 = space();
    			i1 = element("i");
    			add_location(span0, file$j, 7, 8, 199);
    			attr_dev(i0, "class", i0_class_value = "mdi mdi-18px ml-1 " + /*cv*/ ctx[0].icon + " text-color" + " svelte-1fap73r");
    			add_location(i0, file$j, 8, 8, 223);
    			attr_dev(button0, "class", "btn download-cv uppercase svelte-1fap73r");
    			add_location(button0, file$j, 6, 4, 100);
    			attr_dev(div0, "class", "splitter svelte-1fap73r");
    			add_location(div0, file$j, 11, 4, 297);
    			add_location(span1, file$j, 17, 8, 488);
    			attr_dev(i1, "class", i1_class_value = "mdi mdi-18px ml-1 " + /*email*/ ctx[1].icon + " text-color" + " svelte-1fap73r");
    			add_location(i1, file$j, 18, 8, 516);
    			attr_dev(button1, "class", "btn email-me uppercase svelte-1fap73r");
    			add_location(button1, file$j, 13, 4, 331);
    			attr_dev(div1, "class", "bottom-buttons svelte-1fap73r");
    			add_location(div1, file$j, 5, 0, 67);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, button0);
    			append_dev(button0, span0);
    			append_dev(button0, t1);
    			append_dev(button0, i0);
    			append_dev(div1, t2);
    			append_dev(div1, div0);
    			append_dev(div1, t3);
    			append_dev(div1, button1);
    			append_dev(button1, span1);
    			append_dev(button1, t5);
    			append_dev(button1, i1);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*click_handler*/ ctx[2], false, false, false),
    					listen_dev(button1, "click", /*click_handler_1*/ ctx[3], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*cv*/ 1 && i0_class_value !== (i0_class_value = "mdi mdi-18px ml-1 " + /*cv*/ ctx[0].icon + " text-color" + " svelte-1fap73r")) {
    				attr_dev(i0, "class", i0_class_value);
    			}

    			if (dirty & /*email*/ 2 && i1_class_value !== (i1_class_value = "mdi mdi-18px ml-1 " + /*email*/ ctx[1].icon + " text-color" + " svelte-1fap73r")) {
    				attr_dev(i1, "class", i1_class_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$k.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$k($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Footer', slots, []);
    	let { cv = '' } = $$props;
    	let { email = '' } = $$props;
    	const writable_props = ['cv', 'email'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Footer> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => window.location.assign(cv.url);
    	const click_handler_1 = () => window.location.href = `mailto:${email.address}?subject=Hello`;

    	$$self.$$set = $$props => {
    		if ('cv' in $$props) $$invalidate(0, cv = $$props.cv);
    		if ('email' in $$props) $$invalidate(1, email = $$props.email);
    	};

    	$$self.$capture_state = () => ({ cv, email });

    	$$self.$inject_state = $$props => {
    		if ('cv' in $$props) $$invalidate(0, cv = $$props.cv);
    		if ('email' in $$props) $$invalidate(1, email = $$props.email);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [cv, email, click_handler, click_handler_1];
    }

    class Footer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$k, create_fragment$k, safe_not_equal, { cv: 0, email: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Footer",
    			options,
    			id: create_fragment$k.name
    		});
    	}

    	get cv() {
    		throw new Error("<Footer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set cv(value) {
    		throw new Error("<Footer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get email() {
    		throw new Error("<Footer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set email(value) {
    		throw new Error("<Footer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/pages/Profile.svelte generated by Svelte v3.48.0 */
    const file$i = "src/pages/Profile.svelte";

    function create_fragment$j(ctx) {
    	let div5;
    	let div4;
    	let div0;
    	let img0;
    	let img0_src_value;
    	let t0;
    	let div1;
    	let img1;
    	let img1_src_value;
    	let t1;
    	let div2;
    	let h1;
    	let t3;
    	let div3;
    	let span;
    	let t5;
    	let links;
    	let t6;
    	let footer;
    	let current;

    	links = new Links({
    			props: { links: card.links },
    			$$inline: true
    		});

    	footer = new Footer({
    			props: { cv: card.cv, email: card.email },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div5 = element("div");
    			div4 = element("div");
    			div0 = element("div");
    			img0 = element("img");
    			t0 = space();
    			div1 = element("div");
    			img1 = element("img");
    			t1 = space();
    			div2 = element("div");
    			h1 = element("h1");
    			h1.textContent = `${card.fullName}`;
    			t3 = space();
    			div3 = element("div");
    			span = element("span");
    			span.textContent = `${card.profession}`;
    			t5 = space();
    			create_component(links.$$.fragment);
    			t6 = space();
    			create_component(footer.$$.fragment);
    			attr_dev(img0, "class", "banner svelte-1p79ays");
    			if (!src_url_equal(img0.src, img0_src_value = card.coverImage)) attr_dev(img0, "src", img0_src_value);
    			attr_dev(img0, "alt", "banner");
    			add_location(img0, file$i, 9, 12, 304);
    			attr_dev(div0, "class", "banner-container svelte-1p79ays");
    			add_location(div0, file$i, 8, 8, 261);
    			if (!src_url_equal(img1.src, img1_src_value = card.profileImage)) attr_dev(img1, "src", img1_src_value);
    			attr_dev(img1, "alt", "profile pic");
    			attr_dev(img1, "class", "profile-pic svelte-1p79ays");
    			add_location(img1, file$i, 12, 12, 431);
    			attr_dev(div1, "class", "profile-pic-container svelte-1p79ays");
    			add_location(div1, file$i, 11, 8, 383);
    			attr_dev(h1, "id", "full-name");
    			attr_dev(h1, "class", "svelte-1p79ays");
    			add_location(h1, file$i, 16, 12, 559);
    			attr_dev(div2, "class", "full-name");
    			add_location(div2, file$i, 15, 8, 523);
    			attr_dev(span, "class", "block primary-color");
    			attr_dev(span, "id", "profession");
    			add_location(span, file$i, 20, 12, 658);
    			attr_dev(div3, "class", "subtitle svelte-1p79ays");
    			add_location(div3, file$i, 19, 8, 623);
    			attr_dev(div4, "class", "profile-content");
    			add_location(div4, file$i, 7, 4, 223);
    			attr_dev(div5, "class", "grid-item-profile svelte-1p79ays");
    			add_location(div5, file$i, 6, 0, 187);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div5, anchor);
    			append_dev(div5, div4);
    			append_dev(div4, div0);
    			append_dev(div0, img0);
    			append_dev(div4, t0);
    			append_dev(div4, div1);
    			append_dev(div1, img1);
    			append_dev(div4, t1);
    			append_dev(div4, div2);
    			append_dev(div2, h1);
    			append_dev(div4, t3);
    			append_dev(div4, div3);
    			append_dev(div3, span);
    			append_dev(div4, t5);
    			mount_component(links, div4, null);
    			append_dev(div4, t6);
    			mount_component(footer, div4, null);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(links.$$.fragment, local);
    			transition_in(footer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(links.$$.fragment, local);
    			transition_out(footer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div5);
    			destroy_component(links);
    			destroy_component(footer);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$j.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$j($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Profile', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Profile> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ card, Links, Footer });
    	return [];
    }

    class Profile extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$j, create_fragment$j, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Profile",
    			options,
    			id: create_fragment$j.name
    		});
    	}
    }

    /* src/components/pages/Field.svelte generated by Svelte v3.48.0 */

    const file$h = "src/components/pages/Field.svelte";

    // (16:8) {:else}
    function create_else_block(ctx) {
    	let t_value = /*field*/ ctx[0].value + "";
    	let t;

    	const block = {
    		c: function create() {
    			t = text(t_value);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*field*/ 1 && t_value !== (t_value = /*field*/ ctx[0].value + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(16:8) {:else}",
    		ctx
    	});

    	return block;
    }

    // (14:39) 
    function create_if_block_1$2(ctx) {
    	let a;
    	let t_value = /*field*/ ctx[0].value + "";
    	let t;
    	let a_href_value;

    	const block = {
    		c: function create() {
    			a = element("a");
    			t = text(t_value);
    			attr_dev(a, "href", a_href_value = "tel:" + /*field*/ ctx[0].value);
    			add_location(a, file$h, 14, 12, 334);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);
    			append_dev(a, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*field*/ 1 && t_value !== (t_value = /*field*/ ctx[0].value + "")) set_data_dev(t, t_value);

    			if (dirty & /*field*/ 1 && a_href_value !== (a_href_value = "tel:" + /*field*/ ctx[0].value)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$2.name,
    		type: "if",
    		source: "(14:39) ",
    		ctx
    	});

    	return block;
    }

    // (12:8) {#if field.name === 'email'}
    function create_if_block$5(ctx) {
    	let a;
    	let t_value = /*field*/ ctx[0].value + "";
    	let t;
    	let a_href_value;

    	const block = {
    		c: function create() {
    			a = element("a");
    			t = text(t_value);
    			attr_dev(a, "class", "lowercase");
    			attr_dev(a, "href", a_href_value = "mailto:" + /*field*/ ctx[0].value);
    			add_location(a, file$h, 12, 12, 215);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);
    			append_dev(a, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*field*/ 1 && t_value !== (t_value = /*field*/ ctx[0].value + "")) set_data_dev(t, t_value);

    			if (dirty & /*field*/ 1 && a_href_value !== (a_href_value = "mailto:" + /*field*/ ctx[0].value)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$5.name,
    		type: "if",
    		source: "(12:8) {#if field.name === 'email'}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$i(ctx) {
    	let div;
    	let span0;
    	let t0_value = /*field*/ ctx[0].name + "";
    	let t0;
    	let t1;
    	let t2;
    	let span1;

    	function select_block_type(ctx, dirty) {
    		if (/*field*/ ctx[0].name === 'email') return create_if_block$5;
    		if (/*field*/ ctx[0].name === 'tel') return create_if_block_1$2;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			span0 = element("span");
    			t0 = text(t0_value);
    			t1 = text(":");
    			t2 = space();
    			span1 = element("span");
    			if_block.c();
    			attr_dev(span0, "class", "mr-2");
    			add_location(span0, file$h, 8, 4, 100);
    			attr_dev(span1, "class", "right");
    			add_location(span1, file$h, 10, 4, 145);
    			attr_dev(div, "class", "field svelte-j9849");
    			add_location(div, file$h, 7, 0, 76);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, span0);
    			append_dev(span0, t0);
    			append_dev(span0, t1);
    			append_dev(div, t2);
    			append_dev(div, span1);
    			if_block.m(span1, null);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*field*/ 1 && t0_value !== (t0_value = /*field*/ ctx[0].name + "")) set_data_dev(t0, t0_value);

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(span1, null);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$i.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$i($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Field', slots, []);
    	let { field = { name: '', value: '' } } = $$props;
    	const writable_props = ['field'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Field> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('field' in $$props) $$invalidate(0, field = $$props.field);
    	};

    	$$self.$capture_state = () => ({ field });

    	$$self.$inject_state = $$props => {
    		if ('field' in $$props) $$invalidate(0, field = $$props.field);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [field];
    }

    class Field extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$i, create_fragment$i, safe_not_equal, { field: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Field",
    			options,
    			id: create_fragment$i.name
    		});
    	}

    	get field() {
    		throw new Error("<Field>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set field(value) {
    		throw new Error("<Field>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/pages/Fields.svelte generated by Svelte v3.48.0 */
    const file$g = "src/components/pages/Fields.svelte";

    function get_each_context$6(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[1] = list[i];
    	child_ctx[3] = i;
    	return child_ctx;
    }

    // (9:8) {#if i % 2 === 0}
    function create_if_block$4(ctx) {
    	let div;
    	let field0;
    	let t0;
    	let field1;
    	let t1;
    	let current;

    	field0 = new Field({
    			props: { field: /*field*/ ctx[1] },
    			$$inline: true
    		});

    	field1 = new Field({
    			props: {
    				field: /*fields*/ ctx[0][/*i*/ ctx[3] + 1]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div = element("div");
    			create_component(field0.$$.fragment);
    			t0 = space();
    			create_component(field1.$$.fragment);
    			t1 = space();
    			attr_dev(div, "class", "field-group mr-1 svelte-1azyi27");
    			add_location(div, file$g, 9, 12, 185);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(field0, div, null);
    			append_dev(div, t0);
    			mount_component(field1, div, null);
    			append_dev(div, t1);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const field0_changes = {};
    			if (dirty & /*fields*/ 1) field0_changes.field = /*field*/ ctx[1];
    			field0.$set(field0_changes);
    			const field1_changes = {};
    			if (dirty & /*fields*/ 1) field1_changes.field = /*fields*/ ctx[0][/*i*/ ctx[3] + 1];
    			field1.$set(field1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(field0.$$.fragment, local);
    			transition_in(field1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(field0.$$.fragment, local);
    			transition_out(field1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(field0);
    			destroy_component(field1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$4.name,
    		type: "if",
    		source: "(9:8) {#if i % 2 === 0}",
    		ctx
    	});

    	return block;
    }

    // (8:4) {#each fields as field, i}
    function create_each_block$6(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*i*/ ctx[3] % 2 === 0 && create_if_block$4(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (/*i*/ ctx[3] % 2 === 0) if_block.p(ctx, dirty);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$6.name,
    		type: "each",
    		source: "(8:4) {#each fields as field, i}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$h(ctx) {
    	let div;
    	let current;
    	let each_value = /*fields*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$6(get_each_context$6(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(div, "class", "fields uppercase svelte-1azyi27");
    			add_location(div, file$g, 6, 0, 85);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*fields*/ 1) {
    				each_value = /*fields*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$6(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block$6(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$h.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$h($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Fields', slots, []);
    	let { fields = [] } = $$props;
    	const writable_props = ['fields'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Fields> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('fields' in $$props) $$invalidate(0, fields = $$props.fields);
    	};

    	$$self.$capture_state = () => ({ Field, fields });

    	$$self.$inject_state = $$props => {
    		if ('fields' in $$props) $$invalidate(0, fields = $$props.fields);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [fields];
    }

    class Fields extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$h, create_fragment$h, safe_not_equal, { fields: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Fields",
    			options,
    			id: create_fragment$h.name
    		});
    	}

    	get fields() {
    		throw new Error("<Fields>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set fields(value) {
    		throw new Error("<Fields>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/pages/Quote.svelte generated by Svelte v3.48.0 */

    const file$f = "src/components/pages/Quote.svelte";

    function create_fragment$g(ctx) {
    	let div;
    	let span0;
    	let t1;
    	let blockquote;
    	let t2;
    	let t3;
    	let span1;

    	const block = {
    		c: function create() {
    			div = element("div");
    			span0 = element("span");
    			span0.textContent = "\"";
    			t1 = space();
    			blockquote = element("blockquote");
    			t2 = text(/*quote*/ ctx[0]);
    			t3 = space();
    			span1 = element("span");
    			span1.textContent = "\"";
    			attr_dev(span0, "class", "left mt-1 primary-color svelte-sc5p3t");
    			set_style(span0, "margin-left", "-10px");
    			add_location(span0, file$f, 5, 4, 69);
    			add_location(blockquote, file$f, 6, 4, 147);
    			attr_dev(span1, "class", "right mt-3 mr-1 primary-color svelte-sc5p3t");
    			add_location(span1, file$f, 7, 4, 184);
    			attr_dev(div, "class", "quote svelte-sc5p3t");
    			add_location(div, file$f, 4, 0, 45);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, span0);
    			append_dev(div, t1);
    			append_dev(div, blockquote);
    			append_dev(blockquote, t2);
    			append_dev(div, t3);
    			append_dev(div, span1);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*quote*/ 1) set_data_dev(t2, /*quote*/ ctx[0]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$g.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$g($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Quote', slots, []);
    	let { quote = '' } = $$props;
    	const writable_props = ['quote'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Quote> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('quote' in $$props) $$invalidate(0, quote = $$props.quote);
    	};

    	$$self.$capture_state = () => ({ quote });

    	$$self.$inject_state = $$props => {
    		if ('quote' in $$props) $$invalidate(0, quote = $$props.quote);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [quote];
    }

    class Quote extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$g, create_fragment$g, safe_not_equal, { quote: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Quote",
    			options,
    			id: create_fragment$g.name
    		});
    	}

    	get quote() {
    		throw new Error("<Quote>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set quote(value) {
    		throw new Error("<Quote>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/shared/Card.svelte generated by Svelte v3.48.0 */

    const file$e = "src/shared/Card.svelte";

    function create_fragment$f(ctx) {
    	let div;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[1].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[0], null);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (default_slot) default_slot.c();
    			attr_dev(div, "class", "card svelte-uvh3go");
    			add_location(div, file$e, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			if (default_slot) {
    				default_slot.m(div, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 1)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[0],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[0])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[0], dirty, null),
    						null
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$f.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$f($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Card', slots, ['default']);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Card> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('$$scope' in $$props) $$invalidate(0, $$scope = $$props.$$scope);
    	};

    	return [$$scope, slots];
    }

    class Card extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$f, create_fragment$f, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Card",
    			options,
    			id: create_fragment$f.name
    		});
    	}
    }

    /* src/components/pages/Hobby.svelte generated by Svelte v3.48.0 */
    const file$d = "src/components/pages/Hobby.svelte";

    // (11:0) <Card>
    function create_default_slot$3(ctx) {
    	let div;
    	let i;
    	let i_class_value;
    	let t0;
    	let t1_value = /*hobby*/ ctx[0].title + "";
    	let t1;
    	let t2;
    	let t3_value = /*hobby*/ ctx[0].description + "";
    	let t3;

    	const block = {
    		c: function create() {
    			div = element("div");
    			i = element("i");
    			t0 = space();
    			t1 = text(t1_value);
    			t2 = text(" - ");
    			t3 = text(t3_value);
    			attr_dev(i, "class", i_class_value = "mdi mdi-48px " + /*hobby*/ ctx[0].icon + " primary-color mr-1" + " svelte-1mkegbz");
    			add_location(i, file$d, 12, 8, 194);
    			attr_dev(div, "class", "hobby-container svelte-1mkegbz");
    			add_location(div, file$d, 11, 4, 156);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, i);
    			append_dev(div, t0);
    			append_dev(div, t1);
    			append_dev(div, t2);
    			append_dev(div, t3);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*hobby*/ 1 && i_class_value !== (i_class_value = "mdi mdi-48px " + /*hobby*/ ctx[0].icon + " primary-color mr-1" + " svelte-1mkegbz")) {
    				attr_dev(i, "class", i_class_value);
    			}

    			if (dirty & /*hobby*/ 1 && t1_value !== (t1_value = /*hobby*/ ctx[0].title + "")) set_data_dev(t1, t1_value);
    			if (dirty & /*hobby*/ 1 && t3_value !== (t3_value = /*hobby*/ ctx[0].description + "")) set_data_dev(t3, t3_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$3.name,
    		type: "slot",
    		source: "(11:0) <Card>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$e(ctx) {
    	let card;
    	let current;

    	card = new Card({
    			props: {
    				$$slots: { default: [create_default_slot$3] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(card.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(card, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const card_changes = {};

    			if (dirty & /*$$scope, hobby*/ 3) {
    				card_changes.$$scope = { dirty, ctx };
    			}

    			card.$set(card_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(card.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(card.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(card, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$e.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$e($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Hobby', slots, []);
    	let { hobby = { title: '', icon: '', description: '' } } = $$props;
    	const writable_props = ['hobby'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Hobby> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('hobby' in $$props) $$invalidate(0, hobby = $$props.hobby);
    	};

    	$$self.$capture_state = () => ({ Card, hobby });

    	$$self.$inject_state = $$props => {
    		if ('hobby' in $$props) $$invalidate(0, hobby = $$props.hobby);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [hobby];
    }

    class Hobby extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$e, create_fragment$e, safe_not_equal, { hobby: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Hobby",
    			options,
    			id: create_fragment$e.name
    		});
    	}

    	get hobby() {
    		throw new Error("<Hobby>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set hobby(value) {
    		throw new Error("<Hobby>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/pages/About.svelte generated by Svelte v3.48.0 */
    const file$c = "src/pages/About.svelte";

    function get_each_context$5(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[1] = list[i];
    	return child_ctx;
    }

    // (29:4) {#if !!about.hobbies}
    function create_if_block$3(ctx) {
    	let span;
    	let t1;
    	let div;
    	let current;
    	let each_value = about.hobbies;
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$5(get_each_context$5(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			span = element("span");
    			span.textContent = "Hobbies";
    			t1 = space();
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(span, "class", "block mt-3 bold mb-3");
    			add_location(span, file$c, 29, 8, 728);
    			add_location(div, file$c, 30, 8, 786);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*about*/ 0) {
    				each_value = about.hobbies;
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$5(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block$5(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$3.name,
    		type: "if",
    		source: "(29:4) {#if !!about.hobbies}",
    		ctx
    	});

    	return block;
    }

    // (32:12) {#each about.hobbies as hobby}
    function create_each_block$5(ctx) {
    	let div;
    	let hobby;
    	let t;
    	let current;

    	hobby = new Hobby({
    			props: { hobby: /*hobby*/ ctx[1] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div = element("div");
    			create_component(hobby.$$.fragment);
    			t = space();
    			attr_dev(div, "class", "mb-1");
    			add_location(div, file$c, 32, 16, 851);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(hobby, div, null);
    			append_dev(div, t);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(hobby.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(hobby.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(hobby);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$5.name,
    		type: "each",
    		source: "(32:12) {#each about.hobbies as hobby}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$d(ctx) {
    	let div1;
    	let span;
    	let t1;
    	let p;
    	let t3;
    	let div0;
    	let fields_1;
    	let t4;
    	let quote;
    	let t5;
    	let current;

    	fields_1 = new Fields({
    			props: { fields: /*fields*/ ctx[0] },
    			$$inline: true
    		});

    	quote = new Quote({
    			props: { quote: about.quote },
    			$$inline: true
    		});

    	let if_block = !!about.hobbies && create_if_block$3(ctx);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			span = element("span");
    			span.textContent = `${about.greeting}`;
    			t1 = space();
    			p = element("p");
    			p.textContent = `${about.description}`;
    			t3 = space();
    			div0 = element("div");
    			create_component(fields_1.$$.fragment);
    			t4 = space();
    			create_component(quote.$$.fragment);
    			t5 = space();
    			if (if_block) if_block.c();
    			attr_dev(span, "class", "block bold");
    			add_location(span, file$c, 19, 4, 490);
    			attr_dev(p, "class", "description mb-3 svelte-pm7kco");
    			add_location(p, file$c, 20, 4, 543);
    			attr_dev(div0, "class", "mb-3");
    			add_location(div0, file$c, 22, 4, 600);
    			attr_dev(div1, "class", "about-container");
    			add_location(div1, file$c, 17, 0, 455);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, span);
    			append_dev(div1, t1);
    			append_dev(div1, p);
    			append_dev(div1, t3);
    			append_dev(div1, div0);
    			mount_component(fields_1, div0, null);
    			append_dev(div1, t4);
    			mount_component(quote, div1, null);
    			append_dev(div1, t5);
    			if (if_block) if_block.m(div1, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (!!about.hobbies) if_block.p(ctx, dirty);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(fields_1.$$.fragment, local);
    			transition_in(quote.$$.fragment, local);
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(fields_1.$$.fragment, local);
    			transition_out(quote.$$.fragment, local);
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			destroy_component(fields_1);
    			destroy_component(quote);
    			if (if_block) if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$d.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$d($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('About', slots, []);

    	const fields = [
    		{ name: 'age', value: 22 },
    		{ name: 'Location', value: about.residence },
    		{ name: 'email', value: about.freelance },
    		{ name: 'LinkedIn', value: about.address }
    	];

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<About> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ about, Fields, Quote, Hobby, fields });
    	return [fields];
    }

    class About extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$d, create_fragment$d, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "About",
    			options,
    			id: create_fragment$d.name
    		});
    	}
    }

    /* src/components/pages/Resume/Section.svelte generated by Svelte v3.48.0 */

    const file$b = "src/components/pages/Resume/Section.svelte";

    function create_fragment$c(ctx) {
    	let div1;
    	let div0;
    	let i;
    	let i_class_value;
    	let t0;
    	let span;
    	let t1_value = /*item*/ ctx[0].title + "";
    	let t1;
    	let t2;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[2].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], null);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			i = element("i");
    			t0 = space();
    			span = element("span");
    			t1 = text(t1_value);
    			t2 = space();
    			if (default_slot) default_slot.c();
    			attr_dev(i, "class", i_class_value = "mdi mdi-48px " + /*item*/ ctx[0].icon + " mr-1 primary-color" + " svelte-prgd0z");
    			add_location(i, file$b, 9, 8, 121);
    			attr_dev(span, "class", "uppercase");
    			add_location(span, file$b, 10, 8, 189);
    			attr_dev(div0, "class", "section-title svelte-prgd0z");
    			add_location(div0, file$b, 8, 4, 85);
    			add_location(div1, file$b, 7, 0, 75);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div0, i);
    			append_dev(div0, t0);
    			append_dev(div0, span);
    			append_dev(span, t1);
    			append_dev(div1, t2);

    			if (default_slot) {
    				default_slot.m(div1, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*item*/ 1 && i_class_value !== (i_class_value = "mdi mdi-48px " + /*item*/ ctx[0].icon + " mr-1 primary-color" + " svelte-prgd0z")) {
    				attr_dev(i, "class", i_class_value);
    			}

    			if ((!current || dirty & /*item*/ 1) && t1_value !== (t1_value = /*item*/ ctx[0].title + "")) set_data_dev(t1, t1_value);

    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 2)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[1],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[1])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[1], dirty, null),
    						null
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$c.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$c($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Section', slots, ['default']);
    	let { item = { title: '', icon: '' } } = $$props;
    	const writable_props = ['item'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Section> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('item' in $$props) $$invalidate(0, item = $$props.item);
    		if ('$$scope' in $$props) $$invalidate(1, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({ item });

    	$$self.$inject_state = $$props => {
    		if ('item' in $$props) $$invalidate(0, item = $$props.item);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [item, $$scope, slots];
    }

    class Section extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$c, create_fragment$c, safe_not_equal, { item: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Section",
    			options,
    			id: create_fragment$c.name
    		});
    	}

    	get item() {
    		throw new Error("<Section>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set item(value) {
    		throw new Error("<Section>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/pages/Resume/Experience.svelte generated by Svelte v3.48.0 */

    const file$a = "src/components/pages/Resume/Experience.svelte";

    function create_fragment$b(ctx) {
    	let div2;
    	let div0;
    	let span0;
    	let t0_value = /*experience*/ ctx[0].start + "";
    	let t0;
    	let t1;
    	let t2_value = /*experience*/ ctx[0].end + "";
    	let t2;
    	let t3;
    	let span1;
    	let t4_value = /*experience*/ ctx[0].title + "";
    	let t4;
    	let t5;
    	let span2;
    	let t6_value = /*experience*/ ctx[0].company + "";
    	let t6;
    	let t7;
    	let div1;
    	let t8_value = /*experience*/ ctx[0].description + "";
    	let t8;

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			span0 = element("span");
    			t0 = text(t0_value);
    			t1 = text(" - ");
    			t2 = text(t2_value);
    			t3 = space();
    			span1 = element("span");
    			t4 = text(t4_value);
    			t5 = space();
    			span2 = element("span");
    			t6 = text(t6_value);
    			t7 = space();
    			div1 = element("div");
    			t8 = text(t8_value);
    			attr_dev(span0, "class", "duration svelte-1p85ix5");
    			add_location(span0, file$a, 12, 8, 186);
    			add_location(div0, file$a, 11, 4, 172);
    			attr_dev(span1, "class", "block uppercase");
    			add_location(span1, file$a, 14, 4, 269);
    			attr_dev(span2, "class", "block company svelte-1p85ix5");
    			add_location(span2, file$a, 15, 4, 329);
    			attr_dev(div1, "class", "description svelte-1p85ix5");
    			add_location(div1, file$a, 16, 4, 389);
    			attr_dev(div2, "class", "experience mt-2 mb-2 svelte-1p85ix5");
    			add_location(div2, file$a, 10, 0, 133);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			append_dev(div0, span0);
    			append_dev(span0, t0);
    			append_dev(span0, t1);
    			append_dev(span0, t2);
    			append_dev(div2, t3);
    			append_dev(div2, span1);
    			append_dev(span1, t4);
    			append_dev(div2, t5);
    			append_dev(div2, span2);
    			append_dev(span2, t6);
    			append_dev(div2, t7);
    			append_dev(div2, div1);
    			append_dev(div1, t8);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*experience*/ 1 && t0_value !== (t0_value = /*experience*/ ctx[0].start + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*experience*/ 1 && t2_value !== (t2_value = /*experience*/ ctx[0].end + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*experience*/ 1 && t4_value !== (t4_value = /*experience*/ ctx[0].title + "")) set_data_dev(t4, t4_value);
    			if (dirty & /*experience*/ 1 && t6_value !== (t6_value = /*experience*/ ctx[0].company + "")) set_data_dev(t6, t6_value);
    			if (dirty & /*experience*/ 1 && t8_value !== (t8_value = /*experience*/ ctx[0].description + "")) set_data_dev(t8, t8_value);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$b.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$b($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Experience', slots, []);

    	let { experience = {
    		title: '',
    		start: '',
    		end: '',
    		company: '',
    		description: ''
    	} } = $$props;

    	const writable_props = ['experience'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Experience> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('experience' in $$props) $$invalidate(0, experience = $$props.experience);
    	};

    	$$self.$capture_state = () => ({ experience });

    	$$self.$inject_state = $$props => {
    		if ('experience' in $$props) $$invalidate(0, experience = $$props.experience);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [experience];
    }

    class Experience extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$b, create_fragment$b, safe_not_equal, { experience: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Experience",
    			options,
    			id: create_fragment$b.name
    		});
    	}

    	get experience() {
    		throw new Error("<Experience>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set experience(value) {
    		throw new Error("<Experience>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/pages/Resume/Education.svelte generated by Svelte v3.48.0 */

    const file$9 = "src/components/pages/Resume/Education.svelte";

    function create_fragment$a(ctx) {
    	let div2;
    	let div0;
    	let span0;
    	let t0_value = /*education*/ ctx[0].start + "";
    	let t0;
    	let t1;
    	let t2_value = /*education*/ ctx[0].end + "";
    	let t2;
    	let t3;
    	let span1;
    	let t4_value = /*education*/ ctx[0].major + "";
    	let t4;
    	let t5;
    	let span2;
    	let t6_value = /*education*/ ctx[0].institute + "";
    	let t6;
    	let t7;
    	let div1;
    	let t8_value = /*education*/ ctx[0].description + "";
    	let t8;

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			span0 = element("span");
    			t0 = text(t0_value);
    			t1 = text(" - ");
    			t2 = text(t2_value);
    			t3 = space();
    			span1 = element("span");
    			t4 = text(t4_value);
    			t5 = space();
    			span2 = element("span");
    			t6 = text(t6_value);
    			t7 = space();
    			div1 = element("div");
    			t8 = text(t8_value);
    			attr_dev(span0, "class", "duration svelte-1ljglih");
    			add_location(span0, file$9, 12, 8, 186);
    			add_location(div0, file$9, 11, 4, 172);
    			attr_dev(span1, "class", "block uppercase");
    			add_location(span1, file$9, 14, 4, 267);
    			attr_dev(span2, "class", "block institute svelte-1ljglih");
    			add_location(span2, file$9, 15, 4, 326);
    			attr_dev(div1, "class", "description svelte-1ljglih");
    			add_location(div1, file$9, 16, 4, 389);
    			attr_dev(div2, "class", "education mt-2 mb-2 svelte-1ljglih");
    			add_location(div2, file$9, 10, 0, 134);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			append_dev(div0, span0);
    			append_dev(span0, t0);
    			append_dev(span0, t1);
    			append_dev(span0, t2);
    			append_dev(div2, t3);
    			append_dev(div2, span1);
    			append_dev(span1, t4);
    			append_dev(div2, t5);
    			append_dev(div2, span2);
    			append_dev(span2, t6);
    			append_dev(div2, t7);
    			append_dev(div2, div1);
    			append_dev(div1, t8);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*education*/ 1 && t0_value !== (t0_value = /*education*/ ctx[0].start + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*education*/ 1 && t2_value !== (t2_value = /*education*/ ctx[0].end + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*education*/ 1 && t4_value !== (t4_value = /*education*/ ctx[0].major + "")) set_data_dev(t4, t4_value);
    			if (dirty & /*education*/ 1 && t6_value !== (t6_value = /*education*/ ctx[0].institute + "")) set_data_dev(t6, t6_value);
    			if (dirty & /*education*/ 1 && t8_value !== (t8_value = /*education*/ ctx[0].description + "")) set_data_dev(t8, t8_value);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$a($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Education', slots, []);

    	let { education = {
    		major: '',
    		start: '',
    		end: '',
    		institute: '',
    		description: ''
    	} } = $$props;

    	const writable_props = ['education'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Education> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('education' in $$props) $$invalidate(0, education = $$props.education);
    	};

    	$$self.$capture_state = () => ({ education });

    	$$self.$inject_state = $$props => {
    		if ('education' in $$props) $$invalidate(0, education = $$props.education);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [education];
    }

    class Education extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$a, create_fragment$a, safe_not_equal, { education: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Education",
    			options,
    			id: create_fragment$a.name
    		});
    	}

    	get education() {
    		throw new Error("<Education>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set education(value) {
    		throw new Error("<Education>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/pages/Resume/Award.svelte generated by Svelte v3.48.0 */

    const file$8 = "src/components/pages/Resume/Award.svelte";

    function create_fragment$9(ctx) {
    	let div2;
    	let div0;
    	let span0;
    	let t0_value = /*award*/ ctx[0].date + "";
    	let t0;
    	let t1;
    	let span1;
    	let t2_value = /*award*/ ctx[0].title + "";
    	let t2;
    	let t3;
    	let span2;
    	let t4_value = /*award*/ ctx[0].issuedBy + "";
    	let t4;
    	let t5;
    	let div1;
    	let t6_value = /*award*/ ctx[0].description + "";
    	let t6;

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			span0 = element("span");
    			t0 = text(t0_value);
    			t1 = space();
    			span1 = element("span");
    			t2 = text(t2_value);
    			t3 = space();
    			span2 = element("span");
    			t4 = text(t4_value);
    			t5 = space();
    			div1 = element("div");
    			t6 = text(t6_value);
    			attr_dev(span0, "class", "duration svelte-u0g1dt");
    			add_location(span0, file$8, 11, 8, 163);
    			add_location(div0, file$8, 10, 4, 149);
    			attr_dev(span1, "class", "block uppercase");
    			add_location(span1, file$8, 13, 4, 221);
    			attr_dev(span2, "class", "block issued-by svelte-u0g1dt");
    			add_location(span2, file$8, 14, 4, 276);
    			attr_dev(div1, "class", "description svelte-u0g1dt");
    			add_location(div1, file$8, 15, 4, 334);
    			attr_dev(div2, "class", "award mt-2 mb-2 svelte-u0g1dt");
    			add_location(div2, file$8, 9, 0, 115);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			append_dev(div0, span0);
    			append_dev(span0, t0);
    			append_dev(div2, t1);
    			append_dev(div2, span1);
    			append_dev(span1, t2);
    			append_dev(div2, t3);
    			append_dev(div2, span2);
    			append_dev(span2, t4);
    			append_dev(div2, t5);
    			append_dev(div2, div1);
    			append_dev(div1, t6);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*award*/ 1 && t0_value !== (t0_value = /*award*/ ctx[0].date + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*award*/ 1 && t2_value !== (t2_value = /*award*/ ctx[0].title + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*award*/ 1 && t4_value !== (t4_value = /*award*/ ctx[0].issuedBy + "")) set_data_dev(t4, t4_value);
    			if (dirty & /*award*/ 1 && t6_value !== (t6_value = /*award*/ ctx[0].description + "")) set_data_dev(t6, t6_value);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$9($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Award', slots, []);

    	let { award = {
    		title: '',
    		date: '',
    		issuedBy: '',
    		description: ''
    	} } = $$props;

    	const writable_props = ['award'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Award> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('award' in $$props) $$invalidate(0, award = $$props.award);
    	};

    	$$self.$capture_state = () => ({ award });

    	$$self.$inject_state = $$props => {
    		if ('award' in $$props) $$invalidate(0, award = $$props.award);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [award];
    }

    class Award extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$9, create_fragment$9, safe_not_equal, { award: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Award",
    			options,
    			id: create_fragment$9.name
    		});
    	}

    	get award() {
    		throw new Error("<Award>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set award(value) {
    		throw new Error("<Award>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/pages/Resume/Academic.svelte generated by Svelte v3.48.0 */

    const file$7 = "src/components/pages/Resume/Academic.svelte";

    function create_fragment$8(ctx) {
    	let div2;
    	let div0;
    	let span0;
    	let t0_value = /*academic*/ ctx[0].date + "";
    	let t0;
    	let t1;
    	let span1;
    	let t2_value = /*academic*/ ctx[0].title + "";
    	let t2;
    	let t3;
    	let span2;
    	let t4_value = /*academic*/ ctx[0].issuedBy + "";
    	let t4;
    	let t5;
    	let div1;
    	let t6_value = /*academic*/ ctx[0].description + "";
    	let t6;

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			span0 = element("span");
    			t0 = text(t0_value);
    			t1 = space();
    			span1 = element("span");
    			t2 = text(t2_value);
    			t3 = space();
    			span2 = element("span");
    			t4 = text(t4_value);
    			t5 = space();
    			div1 = element("div");
    			t6 = text(t6_value);
    			attr_dev(span0, "class", "duration svelte-zsmcjf");
    			add_location(span0, file$7, 11, 8, 169);
    			add_location(div0, file$7, 10, 4, 155);
    			attr_dev(span1, "class", "block uppercase");
    			add_location(span1, file$7, 13, 4, 230);
    			attr_dev(span2, "class", "block issued-by svelte-zsmcjf");
    			add_location(span2, file$7, 14, 4, 288);
    			attr_dev(div1, "class", "description svelte-zsmcjf");
    			add_location(div1, file$7, 15, 4, 349);
    			attr_dev(div2, "class", "academic mt-2 mb-2 svelte-zsmcjf");
    			add_location(div2, file$7, 9, 0, 118);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			append_dev(div0, span0);
    			append_dev(span0, t0);
    			append_dev(div2, t1);
    			append_dev(div2, span1);
    			append_dev(span1, t2);
    			append_dev(div2, t3);
    			append_dev(div2, span2);
    			append_dev(span2, t4);
    			append_dev(div2, t5);
    			append_dev(div2, div1);
    			append_dev(div1, t6);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*academic*/ 1 && t0_value !== (t0_value = /*academic*/ ctx[0].date + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*academic*/ 1 && t2_value !== (t2_value = /*academic*/ ctx[0].title + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*academic*/ 1 && t4_value !== (t4_value = /*academic*/ ctx[0].issuedBy + "")) set_data_dev(t4, t4_value);
    			if (dirty & /*academic*/ 1 && t6_value !== (t6_value = /*academic*/ ctx[0].description + "")) set_data_dev(t6, t6_value);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$8($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Academic', slots, []);

    	let { academic = {
    		title: '',
    		date: '',
    		issuedBy: '',
    		description: ''
    	} } = $$props;

    	const writable_props = ['academic'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Academic> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('academic' in $$props) $$invalidate(0, academic = $$props.academic);
    	};

    	$$self.$capture_state = () => ({ academic });

    	$$self.$inject_state = $$props => {
    		if ('academic' in $$props) $$invalidate(0, academic = $$props.academic);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [academic];
    }

    class Academic extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$8, create_fragment$8, safe_not_equal, { academic: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Academic",
    			options,
    			id: create_fragment$8.name
    		});
    	}

    	get academic() {
    		throw new Error("<Academic>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set academic(value) {
    		throw new Error("<Academic>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/ProgressBar.svelte generated by Svelte v3.48.0 */

    const file$6 = "src/components/ProgressBar.svelte";

    function get_each_context$4(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[3] = list[i];
    	child_ctx[5] = i;
    	return child_ctx;
    }

    // (12:26) 
    function create_if_block_1$1(ctx) {
    	let div1;
    	let div0;
    	let each_value = Array(20);
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$4(get_each_context$4(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(div0, "class", "dots svelte-ugy53v");
    			add_location(div0, file$6, 13, 8, 323);
    			attr_dev(div1, "class", "mt-1");
    			add_location(div1, file$6, 12, 4, 296);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div0, null);
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*level*/ 2) {
    				each_value = Array(20);
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$4(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$4(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div0, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(12:26) ",
    		ctx
    	});

    	return block;
    }

    // (8:0) {#if type === 'line'}
    function create_if_block$2(ctx) {
    	let div1;
    	let div0;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			attr_dev(div0, "class", "percentage svelte-ugy53v");
    			set_style(div0, "width", /*percentage*/ ctx[2] + "%");
    			add_location(div0, file$6, 9, 8, 194);
    			attr_dev(div1, "class", "progress mt-1 svelte-ugy53v");
    			add_location(div1, file$6, 8, 4, 158);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*percentage*/ 4) {
    				set_style(div0, "width", /*percentage*/ ctx[2] + "%");
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(8:0) {#if type === 'line'}",
    		ctx
    	});

    	return block;
    }

    // (15:12) {#each Array(20) as _, i}
    function create_each_block$4(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "dot svelte-ugy53v");
    			toggle_class(div, "active", /*level*/ ctx[1] > 5 * /*i*/ ctx[5]);
    			add_location(div, file$6, 15, 16, 396);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*level*/ 2) {
    				toggle_class(div, "active", /*level*/ ctx[1] > 5 * /*i*/ ctx[5]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$4.name,
    		type: "each",
    		source: "(15:12) {#each Array(20) as _, i}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$7(ctx) {
    	let if_block_anchor;

    	function select_block_type(ctx, dirty) {
    		if (/*type*/ ctx[0] === 'line') return create_if_block$2;
    		if (/*type*/ ctx[0] === 'dots') return create_if_block_1$1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type && current_block_type(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if (if_block) if_block.d(1);
    				if_block = current_block_type && current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (if_block) {
    				if_block.d(detaching);
    			}

    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let percentage;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ProgressBar', slots, []);
    	let { type = 'line' } = $$props;
    	let { level = 0 } = $$props;
    	const writable_props = ['type', 'level'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<ProgressBar> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('type' in $$props) $$invalidate(0, type = $$props.type);
    		if ('level' in $$props) $$invalidate(1, level = $$props.level);
    	};

    	$$self.$capture_state = () => ({ type, level, percentage });

    	$$self.$inject_state = $$props => {
    		if ('type' in $$props) $$invalidate(0, type = $$props.type);
    		if ('level' in $$props) $$invalidate(1, level = $$props.level);
    		if ('percentage' in $$props) $$invalidate(2, percentage = $$props.percentage);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*level*/ 2) {
    			$$invalidate(2, percentage = level < 0 || level > 100 ? 50 : level);
    		}
    	};

    	return [type, level, percentage];
    }

    class ProgressBar extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, { type: 0, level: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ProgressBar",
    			options,
    			id: create_fragment$7.name
    		});
    	}

    	get type() {
    		throw new Error("<ProgressBar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set type(value) {
    		throw new Error("<ProgressBar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get level() {
    		throw new Error("<ProgressBar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set level(value) {
    		throw new Error("<ProgressBar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/pages/Resume.svelte generated by Svelte v3.48.0 */
    const file$5 = "src/pages/Resume.svelte";

    function get_each_context$3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[0] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[3] = list[i];
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	return child_ctx;
    }

    function get_each_context_3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[9] = list[i];
    	return child_ctx;
    }

    function get_each_context_4(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[12] = list[i];
    	return child_ctx;
    }

    function get_each_context_5(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[15] = list[i];
    	return child_ctx;
    }

    // (13:4) {#if !!resume.experience}
    function create_if_block_4(ctx) {
    	let section;
    	let card;
    	let current;

    	card = new Card({
    			props: {
    				$$slots: { default: [create_default_slot_8] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			section = element("section");
    			create_component(card.$$.fragment);
    			attr_dev(section, "class", "svelte-m6h895");
    			add_location(section, file$5, 13, 8, 594);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			mount_component(card, section, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const card_changes = {};

    			if (dirty & /*$$scope*/ 262144) {
    				card_changes.$$scope = { dirty, ctx };
    			}

    			card.$set(card_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(card.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(card.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    			destroy_component(card);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(13:4) {#if !!resume.experience}",
    		ctx
    	});

    	return block;
    }

    // (18:24) {#each resume.experience.data as experience}
    function create_each_block_5(ctx) {
    	let experience;
    	let current;

    	experience = new Experience({
    			props: { experience: /*experience*/ ctx[15] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(experience.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(experience, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(experience.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(experience.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(experience, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_5.name,
    		type: "each",
    		source: "(18:24) {#each resume.experience.data as experience}",
    		ctx
    	});

    	return block;
    }

    // (16:16) <Section item={resume.experience}>
    function create_default_slot_9(ctx) {
    	let div;
    	let current;
    	let each_value_5 = resume.experience.data;
    	validate_each_argument(each_value_5);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_5.length; i += 1) {
    		each_blocks[i] = create_each_block_5(get_each_context_5(ctx, each_value_5, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			add_location(div, file$5, 16, 20, 694);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*resume*/ 0) {
    				each_value_5 = resume.experience.data;
    				validate_each_argument(each_value_5);
    				let i;

    				for (i = 0; i < each_value_5.length; i += 1) {
    					const child_ctx = get_each_context_5(ctx, each_value_5, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block_5(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div, null);
    					}
    				}

    				group_outros();

    				for (i = each_value_5.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value_5.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_9.name,
    		type: "slot",
    		source: "(16:16) <Section item={resume.experience}>",
    		ctx
    	});

    	return block;
    }

    // (15:12) <Card>
    function create_default_slot_8(ctx) {
    	let section;
    	let current;

    	section = new Section({
    			props: {
    				item: resume.experience,
    				$$slots: { default: [create_default_slot_9] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(section.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(section, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const section_changes = {};

    			if (dirty & /*$$scope*/ 262144) {
    				section_changes.$$scope = { dirty, ctx };
    			}

    			section.$set(section_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(section.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(section.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(section, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_8.name,
    		type: "slot",
    		source: "(15:12) <Card>",
    		ctx
    	});

    	return block;
    }

    // (27:4) {#if !!resume.education}
    function create_if_block_3(ctx) {
    	let section;
    	let card;
    	let current;

    	card = new Card({
    			props: {
    				$$slots: { default: [create_default_slot_6] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			section = element("section");
    			create_component(card.$$.fragment);
    			attr_dev(section, "class", "svelte-m6h895");
    			add_location(section, file$5, 27, 8, 997);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			mount_component(card, section, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const card_changes = {};

    			if (dirty & /*$$scope*/ 262144) {
    				card_changes.$$scope = { dirty, ctx };
    			}

    			card.$set(card_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(card.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(card.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    			destroy_component(card);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(27:4) {#if !!resume.education}",
    		ctx
    	});

    	return block;
    }

    // (32:24) {#each resume.education.data as education}
    function create_each_block_4(ctx) {
    	let education;
    	let current;

    	education = new Education({
    			props: { education: /*education*/ ctx[12] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(education.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(education, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(education.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(education.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(education, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_4.name,
    		type: "each",
    		source: "(32:24) {#each resume.education.data as education}",
    		ctx
    	});

    	return block;
    }

    // (30:16) <Section item={resume.education}>
    function create_default_slot_7(ctx) {
    	let div;
    	let current;
    	let each_value_4 = resume.education.data;
    	validate_each_argument(each_value_4);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_4.length; i += 1) {
    		each_blocks[i] = create_each_block_4(get_each_context_4(ctx, each_value_4, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			add_location(div, file$5, 30, 20, 1096);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*resume*/ 0) {
    				each_value_4 = resume.education.data;
    				validate_each_argument(each_value_4);
    				let i;

    				for (i = 0; i < each_value_4.length; i += 1) {
    					const child_ctx = get_each_context_4(ctx, each_value_4, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block_4(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div, null);
    					}
    				}

    				group_outros();

    				for (i = each_value_4.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value_4.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_7.name,
    		type: "slot",
    		source: "(30:16) <Section item={resume.education}>",
    		ctx
    	});

    	return block;
    }

    // (29:12) <Card>
    function create_default_slot_6(ctx) {
    	let section;
    	let current;

    	section = new Section({
    			props: {
    				item: resume.education,
    				$$slots: { default: [create_default_slot_7] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(section.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(section, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const section_changes = {};

    			if (dirty & /*$$scope*/ 262144) {
    				section_changes.$$scope = { dirty, ctx };
    			}

    			section.$set(section_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(section.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(section.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(section, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_6.name,
    		type: "slot",
    		source: "(29:12) <Card>",
    		ctx
    	});

    	return block;
    }

    // (41:4) {#if !!resume.certificatesAndAwards}
    function create_if_block_2(ctx) {
    	let section;
    	let card;
    	let current;

    	card = new Card({
    			props: {
    				$$slots: { default: [create_default_slot_4] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			section = element("section");
    			create_component(card.$$.fragment);
    			attr_dev(section, "class", "svelte-m6h895");
    			add_location(section, file$5, 41, 8, 1407);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			mount_component(card, section, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const card_changes = {};

    			if (dirty & /*$$scope*/ 262144) {
    				card_changes.$$scope = { dirty, ctx };
    			}

    			card.$set(card_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(card.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(card.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    			destroy_component(card);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(41:4) {#if !!resume.certificatesAndAwards}",
    		ctx
    	});

    	return block;
    }

    // (46:24) {#each resume.certificatesAndAwards.data as award}
    function create_each_block_3(ctx) {
    	let award;
    	let current;

    	award = new Award({
    			props: { award: /*award*/ ctx[9] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(award.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(award, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(award.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(award.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(award, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_3.name,
    		type: "each",
    		source: "(46:24) {#each resume.certificatesAndAwards.data as award}",
    		ctx
    	});

    	return block;
    }

    // (44:16) <Section item={resume.certificatesAndAwards}>
    function create_default_slot_5(ctx) {
    	let div;
    	let current;
    	let each_value_3 = resume.certificatesAndAwards.data;
    	validate_each_argument(each_value_3);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_3.length; i += 1) {
    		each_blocks[i] = create_each_block_3(get_each_context_3(ctx, each_value_3, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			add_location(div, file$5, 44, 20, 1518);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*resume*/ 0) {
    				each_value_3 = resume.certificatesAndAwards.data;
    				validate_each_argument(each_value_3);
    				let i;

    				for (i = 0; i < each_value_3.length; i += 1) {
    					const child_ctx = get_each_context_3(ctx, each_value_3, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block_3(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div, null);
    					}
    				}

    				group_outros();

    				for (i = each_value_3.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value_3.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_5.name,
    		type: "slot",
    		source: "(44:16) <Section item={resume.certificatesAndAwards}>",
    		ctx
    	});

    	return block;
    }

    // (43:12) <Card>
    function create_default_slot_4(ctx) {
    	let section;
    	let current;

    	section = new Section({
    			props: {
    				item: resume.certificatesAndAwards,
    				$$slots: { default: [create_default_slot_5] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(section.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(section, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const section_changes = {};

    			if (dirty & /*$$scope*/ 262144) {
    				section_changes.$$scope = { dirty, ctx };
    			}

    			section.$set(section_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(section.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(section.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(section, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_4.name,
    		type: "slot",
    		source: "(43:12) <Card>",
    		ctx
    	});

    	return block;
    }

    // (55:4) {#if !!resume.academic}
    function create_if_block_1(ctx) {
    	let section;
    	let card;
    	let current;

    	card = new Card({
    			props: {
    				$$slots: { default: [create_default_slot_2] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			section = element("section");
    			create_component(card.$$.fragment);
    			attr_dev(section, "class", "svelte-m6h895");
    			add_location(section, file$5, 55, 8, 1816);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			mount_component(card, section, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const card_changes = {};

    			if (dirty & /*$$scope*/ 262144) {
    				card_changes.$$scope = { dirty, ctx };
    			}

    			card.$set(card_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(card.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(card.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    			destroy_component(card);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(55:4) {#if !!resume.academic}",
    		ctx
    	});

    	return block;
    }

    // (60:24) {#each resume.academic.data as academic}
    function create_each_block_2(ctx) {
    	let academic;
    	let current;

    	academic = new Academic({
    			props: { academic: /*academic*/ ctx[6] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(academic.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(academic, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(academic.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(academic.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(academic, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_2.name,
    		type: "each",
    		source: "(60:24) {#each resume.academic.data as academic}",
    		ctx
    	});

    	return block;
    }

    // (58:16) <Section item={resume.academic}>
    function create_default_slot_3(ctx) {
    	let div;
    	let current;
    	let each_value_2 = resume.academic.data;
    	validate_each_argument(each_value_2);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_2.length; i += 1) {
    		each_blocks[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			add_location(div, file$5, 58, 20, 1914);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*resume*/ 0) {
    				each_value_2 = resume.academic.data;
    				validate_each_argument(each_value_2);
    				let i;

    				for (i = 0; i < each_value_2.length; i += 1) {
    					const child_ctx = get_each_context_2(ctx, each_value_2, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block_2(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div, null);
    					}
    				}

    				group_outros();

    				for (i = each_value_2.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value_2.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_3.name,
    		type: "slot",
    		source: "(58:16) <Section item={resume.academic}>",
    		ctx
    	});

    	return block;
    }

    // (57:12) <Card>
    function create_default_slot_2(ctx) {
    	let section;
    	let current;

    	section = new Section({
    			props: {
    				item: resume.academic,
    				$$slots: { default: [create_default_slot_3] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(section.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(section, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const section_changes = {};

    			if (dirty & /*$$scope*/ 262144) {
    				section_changes.$$scope = { dirty, ctx };
    			}

    			section.$set(section_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(section.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(section.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(section, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_2.name,
    		type: "slot",
    		source: "(57:12) <Card>",
    		ctx
    	});

    	return block;
    }

    // (69:4) {#if !!resume.skills}
    function create_if_block$1(ctx) {
    	let span;
    	let t1;
    	let each_1_anchor;
    	let current;
    	let each_value = resume.skills;
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$3(get_each_context$3(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			span = element("span");
    			span.textContent = "Skills";
    			t1 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    			attr_dev(span, "class", "block bold mt-2 mb-2 ");
    			set_style(span, "width", "100%");
    			add_location(span, file$5, 69, 8, 2206);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			insert_dev(target, t1, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*resume*/ 0) {
    				each_value = resume.skills;
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$3(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block$3(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    			if (detaching) detach_dev(t1);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(69:4) {#if !!resume.skills}",
    		ctx
    	});

    	return block;
    }

    // (77:28) {#each skillData.items as skill}
    function create_each_block_1(ctx) {
    	let div;
    	let span;
    	let t0_value = /*skill*/ ctx[3].title + "";
    	let t0;
    	let t1;
    	let progressbar;
    	let t2;
    	let current;

    	progressbar = new ProgressBar({
    			props: {
    				type: /*skillData*/ ctx[0].barType,
    				level: /*skill*/ ctx[3].level
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div = element("div");
    			span = element("span");
    			t0 = text(t0_value);
    			t1 = space();
    			create_component(progressbar.$$.fragment);
    			t2 = space();
    			add_location(span, file$5, 78, 36, 2590);
    			attr_dev(div, "class", "mt-2");
    			add_location(div, file$5, 77, 32, 2535);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, span);
    			append_dev(span, t0);
    			append_dev(div, t1);
    			mount_component(progressbar, div, null);
    			append_dev(div, t2);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(progressbar.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(progressbar.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(progressbar);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(77:28) {#each skillData.items as skill}",
    		ctx
    	});

    	return block;
    }

    // (75:20) <Section item={skillData}>
    function create_default_slot_1(ctx) {
    	let div;
    	let current;
    	let each_value_1 = /*skillData*/ ctx[0].items;
    	validate_each_argument(each_value_1);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			add_location(div, file$5, 75, 24, 2436);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*resume*/ 0) {
    				each_value_1 = /*skillData*/ ctx[0].items;
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div, null);
    					}
    				}

    				group_outros();

    				for (i = each_value_1.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value_1.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_1.name,
    		type: "slot",
    		source: "(75:20) <Section item={skillData}>",
    		ctx
    	});

    	return block;
    }

    // (74:16) <Card>
    function create_default_slot$2(ctx) {
    	let section;
    	let current;

    	section = new Section({
    			props: {
    				item: /*skillData*/ ctx[0],
    				$$slots: { default: [create_default_slot_1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(section.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(section, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const section_changes = {};

    			if (dirty & /*$$scope*/ 262144) {
    				section_changes.$$scope = { dirty, ctx };
    			}

    			section.$set(section_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(section.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(section.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(section, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$2.name,
    		type: "slot",
    		source: "(74:16) <Card>",
    		ctx
    	});

    	return block;
    }

    // (72:8) {#each resume.skills as skillData}
    function create_each_block$3(ctx) {
    	let section;
    	let card;
    	let t;
    	let current;

    	card = new Card({
    			props: {
    				$$slots: { default: [create_default_slot$2] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			section = element("section");
    			create_component(card.$$.fragment);
    			t = space();
    			attr_dev(section, "class", "svelte-m6h895");
    			add_location(section, file$5, 72, 12, 2332);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			mount_component(card, section, null);
    			append_dev(section, t);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const card_changes = {};

    			if (dirty & /*$$scope*/ 262144) {
    				card_changes.$$scope = { dirty, ctx };
    			}

    			card.$set(card_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(card.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(card.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    			destroy_component(card);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$3.name,
    		type: "each",
    		source: "(72:8) {#each resume.skills as skillData}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$6(ctx) {
    	let div;
    	let t0;
    	let t1;
    	let t2;
    	let t3;
    	let current;
    	let if_block0 = !!resume.experience && create_if_block_4(ctx);
    	let if_block1 = !!resume.education && create_if_block_3(ctx);
    	let if_block2 = !!resume.certificatesAndAwards && create_if_block_2(ctx);
    	let if_block3 = !!resume.academic && create_if_block_1(ctx);
    	let if_block4 = !!resume.skills && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (if_block0) if_block0.c();
    			t0 = space();
    			if (if_block1) if_block1.c();
    			t1 = space();
    			if (if_block2) if_block2.c();
    			t2 = space();
    			if (if_block3) if_block3.c();
    			t3 = space();
    			if (if_block4) if_block4.c();
    			attr_dev(div, "class", "resume-container svelte-m6h895");
    			add_location(div, file$5, 11, 0, 525);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if (if_block0) if_block0.m(div, null);
    			append_dev(div, t0);
    			if (if_block1) if_block1.m(div, null);
    			append_dev(div, t1);
    			if (if_block2) if_block2.m(div, null);
    			append_dev(div, t2);
    			if (if_block3) if_block3.m(div, null);
    			append_dev(div, t3);
    			if (if_block4) if_block4.m(div, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (!!resume.experience) if_block0.p(ctx, dirty);
    			if (!!resume.education) if_block1.p(ctx, dirty);
    			if (!!resume.certificatesAndAwards) if_block2.p(ctx, dirty);
    			if (!!resume.academic) if_block3.p(ctx, dirty);
    			if (!!resume.skills) if_block4.p(ctx, dirty);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block0);
    			transition_in(if_block1);
    			transition_in(if_block2);
    			transition_in(if_block3);
    			transition_in(if_block4);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block0);
    			transition_out(if_block1);
    			transition_out(if_block2);
    			transition_out(if_block3);
    			transition_out(if_block4);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    			if (if_block3) if_block3.d();
    			if (if_block4) if_block4.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Resume', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Resume> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		resume,
    		Section,
    		Card,
    		Experience,
    		Education,
    		Award,
    		Academic,
    		ProgressBar
    	});

    	return [];
    }

    class Resume extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Resume",
    			options,
    			id: create_fragment$6.name
    		});
    	}
    }

    /* src/components/pages/Product.svelte generated by Svelte v3.48.0 */
    const file$4 = "src/components/pages/Product.svelte";

    // (11:0) <Card>
    function create_default_slot$1(ctx) {
    	let div1;
    	let div0;
    	let i;
    	let i_class_value;
    	let t0;
    	let span0;
    	let t1_value = /*product*/ ctx[0].title + "";
    	let t1;
    	let t2;
    	let span1;
    	let t3_value = /*product*/ ctx[0].description + "";
    	let t3;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			i = element("i");
    			t0 = space();
    			span0 = element("span");
    			t1 = text(t1_value);
    			t2 = space();
    			span1 = element("span");
    			t3 = text(t3_value);
    			attr_dev(i, "class", i_class_value = "mdi mdi-48px " + /*product*/ ctx[0].icon + " mr-1 primary-color" + " svelte-1685fw3");
    			add_location(i, file$4, 13, 12, 235);
    			attr_dev(span0, "class", "uppercase");
    			add_location(span0, file$4, 14, 12, 310);
    			attr_dev(div0, "class", "product-title mb-2 svelte-1685fw3");
    			add_location(div0, file$4, 12, 8, 190);
    			add_location(span1, file$4, 16, 8, 380);
    			attr_dev(div1, "class", "container svelte-1685fw3");
    			add_location(div1, file$4, 11, 4, 158);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div0, i);
    			append_dev(div0, t0);
    			append_dev(div0, span0);
    			append_dev(span0, t1);
    			append_dev(div1, t2);
    			append_dev(div1, span1);
    			append_dev(span1, t3);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*product*/ 1 && i_class_value !== (i_class_value = "mdi mdi-48px " + /*product*/ ctx[0].icon + " mr-1 primary-color" + " svelte-1685fw3")) {
    				attr_dev(i, "class", i_class_value);
    			}

    			if (dirty & /*product*/ 1 && t1_value !== (t1_value = /*product*/ ctx[0].title + "")) set_data_dev(t1, t1_value);
    			if (dirty & /*product*/ 1 && t3_value !== (t3_value = /*product*/ ctx[0].description + "")) set_data_dev(t3, t3_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$1.name,
    		type: "slot",
    		source: "(11:0) <Card>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
    	let card;
    	let current;

    	card = new Card({
    			props: {
    				$$slots: { default: [create_default_slot$1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(card.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(card, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const card_changes = {};

    			if (dirty & /*$$scope, product*/ 3) {
    				card_changes.$$scope = { dirty, ctx };
    			}

    			card.$set(card_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(card.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(card.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(card, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Product', slots, []);
    	let { product = { title: '', icon: '', description: '' } } = $$props;
    	const writable_props = ['product'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Product> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('product' in $$props) $$invalidate(0, product = $$props.product);
    	};

    	$$self.$capture_state = () => ({ Card, product });

    	$$self.$inject_state = $$props => {
    		if ('product' in $$props) $$invalidate(0, product = $$props.product);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [product];
    }

    class Product extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, { product: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Product",
    			options,
    			id: create_fragment$5.name
    		});
    	}

    	get product() {
    		throw new Error("<Product>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set product(value) {
    		throw new Error("<Product>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/pages/Services.svelte generated by Svelte v3.48.0 */
    const file$3 = "src/pages/Services.svelte";

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[0] = list[i];
    	return child_ctx;
    }

    // (9:4) {#each services.products as product}
    function create_each_block$2(ctx) {
    	let div;
    	let product;
    	let t;
    	let current;

    	product = new Product({
    			props: { product: /*product*/ ctx[0] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div = element("div");
    			create_component(product.$$.fragment);
    			t = space();
    			attr_dev(div, "class", "product svelte-1buubc");
    			add_location(div, file$3, 9, 8, 278);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(product, div, null);
    			append_dev(div, t);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(product.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(product.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(product);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$2.name,
    		type: "each",
    		source: "(9:4) {#each services.products as product}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let span;
    	let t1;
    	let div;
    	let current;
    	let each_value = services.products;
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			span = element("span");
    			span.textContent = `${services.header}`;
    			t1 = space();
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(span, "class", "block bold mb-2");
    			add_location(span, file$3, 6, 0, 141);
    			attr_dev(div, "class", "services-container svelte-1buubc");
    			add_location(div, file$3, 7, 0, 196);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*services*/ 0) {
    				each_value = services.products;
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$2(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block$2(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Services', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Services> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ services, Product });
    	return [];
    }

    class Services extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Services",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    /* src/pages/Contact.svelte generated by Svelte v3.48.0 */
    const file$2 = "src/pages/Contact.svelte";

    // (22:8) <Card>
    function create_default_slot(ctx) {
    	let fields_1;
    	let current;

    	fields_1 = new Fields({
    			props: { fields: /*fields*/ ctx[0] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(fields_1.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(fields_1, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(fields_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(fields_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(fields_1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(22:8) <Card>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let div2;
    	let span;
    	let t1;
    	let div0;
    	let raw_value = contact.mapsIframe + "";
    	let t2;
    	let div1;
    	let card;
    	let current;

    	card = new Card({
    			props: {
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			span = element("span");
    			span.textContent = `${contact.header}`;
    			t1 = space();
    			div0 = element("div");
    			t2 = space();
    			div1 = element("div");
    			create_component(card.$$.fragment);
    			attr_dev(span, "class", "block bold mb-2");
    			add_location(span, file$2, 14, 4, 413);
    			attr_dev(div0, "class", "map mb-3");
    			add_location(div0, file$2, 16, 4, 472);
    			attr_dev(div1, "class", "mb-3");
    			add_location(div1, file$2, 20, 4, 546);
    			attr_dev(div2, "class", "contact-container");
    			add_location(div2, file$2, 13, 0, 377);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, span);
    			append_dev(div2, t1);
    			append_dev(div2, div0);
    			div0.innerHTML = raw_value;
    			append_dev(div2, t2);
    			append_dev(div2, div1);
    			mount_component(card, div1, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const card_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				card_changes.$$scope = { dirty, ctx };
    			}

    			card.$set(card_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(card.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(card.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			destroy_component(card);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Contact', slots, []);

    	const fields = [
    		{ name: 'address', value: contact.address },
    		{ name: 'email', value: contact.email },
    		{ name: 'hours', value: contact.hours },
    		{ name: 'tel', value: contact.tel }
    	];

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Contact> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ contact, Fields, Card, fields });
    	return [fields];
    }

    class Contact extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Contact",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* src/components/Drawer.svelte generated by Svelte v3.48.0 */
    const file$1 = "src/components/Drawer.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[2] = list[i];
    	return child_ctx;
    }

    // (20:8) {#if item.active}
    function create_if_block(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;
    	var switch_value = /*components*/ ctx[1][/*item*/ ctx[2].name];

    	function switch_props(ctx) {
    		return { $$inline: true };
    	}

    	if (switch_value) {
    		switch_instance = new switch_value(switch_props());
    	}

    	const block = {
    		c: function create() {
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (switch_instance) {
    				mount_component(switch_instance, target, anchor);
    			}

    			insert_dev(target, switch_instance_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (switch_value !== (switch_value = /*components*/ ctx[1][/*item*/ ctx[2].name])) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props());
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(switch_instance_anchor);
    			if (switch_instance) destroy_component(switch_instance, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(20:8) {#if item.active}",
    		ctx
    	});

    	return block;
    }

    // (19:4) {#each $TabStore as item (item.name)}
    function create_each_block$1(key_1, ctx) {
    	let first;
    	let if_block_anchor;
    	let current;
    	let if_block = /*item*/ ctx[2].active && create_if_block(ctx);

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			first = empty();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			this.first = first;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, first, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (/*item*/ ctx[2].active) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*$TabStore*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(first);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(19:4) {#each $TabStore as item (item.name)}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let div;
    	let a;
    	let t;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let current;
    	let each_value = /*$TabStore*/ ctx[0];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*item*/ ctx[2].name;
    	validate_each_keys(ctx, each_value, get_each_context$1, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context$1(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block$1(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			a = element("a");
    			t = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(a, "id", "drawer-anchor");
    			set_style(a, "display", "inline");
    			add_location(a, file$1, 16, 4, 423);
    			attr_dev(div, "class", "grid-item-drawer mb-1 mt-2 svelte-1ema7hz");
    			add_location(div, file$1, 15, 0, 378);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, a);
    			append_dev(div, t);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*components, $TabStore*/ 3) {
    				each_value = /*$TabStore*/ ctx[0];
    				validate_each_argument(each_value);
    				group_outros();
    				validate_each_keys(ctx, each_value, get_each_context$1, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, div, outro_and_destroy_block, create_each_block$1, null, get_each_context$1);
    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let $TabStore;
    	validate_store(TabStore, 'TabStore');
    	component_subscribe($$self, TabStore, $$value => $$invalidate(0, $TabStore = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Drawer', slots, []);

    	const components = {
    		'about': About,
    		'resume': Resume,
    		'services': Services,
    		'contact': Contact
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Drawer> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		About,
    		Resume,
    		Services,
    		Contact,
    		TabStore,
    		components,
    		$TabStore
    	});

    	return [$TabStore, components];
    }

    class Drawer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Drawer",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* src/components/Copyright.svelte generated by Svelte v3.48.0 */

    function create_fragment$1(ctx) {
    	const block = {
    		c: noop,
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: noop,
    		p: noop,
    		i: noop,
    		o: noop,
    		d: noop
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Copyright', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Copyright> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Copyright extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Copyright",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src/App.svelte generated by Svelte v3.48.0 */
    const file = "src/App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[0] = list[i];
    	return child_ctx;
    }

    // (14:4) {#each meta as m (m.name)}
    function create_each_block(key_1, ctx) {
    	let meta_1;

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			meta_1 = element("meta");
    			attr_dev(meta_1, "name", /*m*/ ctx[0].name);
    			attr_dev(meta_1, "content", /*m*/ ctx[0].content);
    			add_location(meta_1, file, 14, 8, 488);
    			this.first = meta_1;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, meta_1, anchor);
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(meta_1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(14:4) {#each meta as m (m.name)}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let link;
    	let title_value;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let each_1_anchor;
    	let t0;
    	let background;
    	let t1;
    	let main;
    	let div;
    	let header;
    	let t2;
    	let profile;
    	let t3;
    	let drawer;
    	let t4;
    	let copyright;
    	let current;
    	document.title = title_value = title;
    	let each_value = meta;
    	validate_each_argument(each_value);
    	const get_key = ctx => /*m*/ ctx[0].name;
    	validate_each_keys(ctx, each_value, get_each_context, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
    	}

    	background = new Background({ $$inline: true });
    	header = new Header({ $$inline: true });
    	profile = new Profile({ $$inline: true });
    	drawer = new Drawer({ $$inline: true });
    	copyright = new Copyright({ $$inline: true });

    	const block = {
    		c: function create() {
    			link = element("link");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    			t0 = space();
    			create_component(background.$$.fragment);
    			t1 = space();
    			main = element("main");
    			div = element("div");
    			create_component(header.$$.fragment);
    			t2 = space();
    			create_component(profile.$$.fragment);
    			t3 = space();
    			create_component(drawer.$$.fragment);
    			t4 = space();
    			create_component(copyright.$$.fragment);
    			attr_dev(link, "rel", "icon");
    			attr_dev(link, "type", "image/png");
    			attr_dev(link, "href", favicon);
    			add_location(link, file, 10, 4, 371);
    			attr_dev(div, "class", "container svelte-1hlajfk");
    			add_location(div, file, 20, 4, 582);
    			attr_dev(main, "class", "svelte-1hlajfk");
    			add_location(main, file, 19, 0, 571);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			append_dev(document.head, link);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(document.head, null);
    			}

    			append_dev(document.head, each_1_anchor);
    			insert_dev(target, t0, anchor);
    			mount_component(background, target, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, main, anchor);
    			append_dev(main, div);
    			mount_component(header, div, null);
    			append_dev(div, t2);
    			mount_component(profile, div, null);
    			append_dev(div, t3);
    			mount_component(drawer, div, null);
    			insert_dev(target, t4, anchor);
    			mount_component(copyright, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if ((!current || dirty & /*title*/ 0) && title_value !== (title_value = title)) {
    				document.title = title_value;
    			}

    			if (dirty & /*meta*/ 0) {
    				each_value = meta;
    				validate_each_argument(each_value);
    				validate_each_keys(ctx, each_value, get_each_context, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, each_1_anchor.parentNode, destroy_block, create_each_block, each_1_anchor, get_each_context);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(background.$$.fragment, local);
    			transition_in(header.$$.fragment, local);
    			transition_in(profile.$$.fragment, local);
    			transition_in(drawer.$$.fragment, local);
    			transition_in(copyright.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(background.$$.fragment, local);
    			transition_out(header.$$.fragment, local);
    			transition_out(profile.$$.fragment, local);
    			transition_out(drawer.$$.fragment, local);
    			transition_out(copyright.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			detach_dev(link);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}

    			detach_dev(each_1_anchor);
    			if (detaching) detach_dev(t0);
    			destroy_component(background, detaching);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(main);
    			destroy_component(header);
    			destroy_component(profile);
    			destroy_component(drawer);
    			if (detaching) detach_dev(t4);
    			destroy_component(copyright, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		Background,
    		Header,
    		Profile,
    		Drawer,
    		favicon,
    		title,
    		meta,
    		Copyright
    	});

    	return [];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
