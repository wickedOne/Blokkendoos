/**
 * Blokkendoos by Ziao, a jQuery plugin for CruiseTravel. http://github.com/Ziao/Blokkendoos
 *
 * Dependencies:
 * - Livequery (must be loaded before Blokkendoos) -> http://github.com/brandonaaron/livequery
 *
 *
 * Usage:
 *
 * Call .blokkendoos() on an element, passing along the following options in an object (all optional)
 * - clone (boolean). Should elements be cloned (multiple instances possible) or moved (never more then 1 of a kind ends up in the grid). Default: False
 * - fadeEffect (boolean). When true, does a little fade animation when (re)placing blocks. Default: true
 *
 * Call .blokkendoos('data') on the same element to retrieve an object containing the data of which blocks are in what cells. Format: cell-id => block-id
 *
 *
 * Requirements:
 * - Have ONE element inside the wrapper with the attribute data-bd-stash (no value required). This 'stash' will contain the available blocks
 * -- Inside this stash, create the blocks any way you like, but give them the attribute data-bd-block-id. The value of this must be unique.
 * - Have ONE element inside the wrapper with the attribute data-bd-grid (no value required). This is where the
 * -- Define cells inside the grid. These are the positions that the blocks can be put in. Must have the attribute data-bd-cell-id. The value of this must be unique.
 */

(function ($) {

    var defaultOptions = {
        clone:      false,
        fadeEffect: true
    }

    var methods = {
        init: function ($el, argOptions) {
            var options = $.extend({}, defaultOptions, argOptions);
            var data = {};
            $el.data('bd-options', options);
            $el.data('bd-data', data);


            //make the blocks draggable
            $el.find("*[data-bd-stash] *[data-bd-block-id]").livequery(function () {
                $(this).draggable({
                    helper:  'clone',
                    opacity: 0.5
                });
            });

            //make the gridcells accept the blocks, and handle what happens next
            $el.find("*[data-bd-grid] *[data-bd-cell-id]").livequery(function () {

                $(this).droppable({
                    accept:     '*[data-bd-block-id]',
                    hoverClass: 'bd-cell-hover',
                    drop:       function (e, ui) {
                        var $block = $(ui.draggable);
                        var $cell = $(this);
                        methods.moveBlock($el, options, data, $block, $cell);
                    }
                });
            });

            //make the stash itself accept blocks that have been dragged back from the grid
            $el.find("*[data-bd-stash]").droppable({
                accept:     '*[data-bd-grid] *[data-bd-block-id]',
                hoverClass: 'bd-cell-hover',
                drop:       function (e, ui) {
                    //note: Since we are calling removeBlock(), if user drops a block in a stash it's not meant to go in, it will find the right stash and still remove it
                    var $block = $(ui.draggable);
                    methods.removeBlock($el, options, data, $block);
                }
            });
        },

        moveBlock: function ($el, options, data, $block, $cell) {

            if (!$sourceCell && options.clone) {
                //master wishes for us to clone blocks (from the stash). We obey.
                $block = $block.clone(true, true);
            }

            //is this block allowed to go in this cell?
            if (!methods.allowBlock($block, $cell)) {
                return false;
            }

            var $sourceCell = $block.data('bd-cell');
            var $currentBlock = $cell.data('bd-block');

            //there's already a block in here
            if ($currentBlock) {


                if ($sourceCell) {
                    //current block has to move, either switch them around or move it to the stash
                    $currentBlock.appendTo($sourceCell);
                    $currentBlock.data('bd-cell', $sourceCell);
                    $sourceCell.data('bd-block', $currentBlock);

                    methods.fadeEffect(options, $currentBlock);

                } else {
                    //we dragged from the stash, remove the block that was occupying this cell
                    methods.removeBlock($el, options, data, $currentBlock);

                }
            } else if ($sourceCell) {
                //clear the source cell so it no longer thinks it's holding a block
                $sourceCell.data('bd-block', null);
            }

            $block.appendTo($cell);
            methods.fadeEffect(options, $block);

            $block.data('bd-cell', $cell);
            $cell.data('bd-block', $block);
        },

        removeBlock: function ($el, options, data, $block) {
            var $sourceCell = $block.data('bd-cell');
            $sourceCell.data('bd-block', null);
            $block.data('bd-cell', null);

            if (options.clone) {
                //cloning; simply remove the block
                $block.remove();
            } else {
                //not cloning, so moving the block back to the stash
                var $stash = methods.findStash($el, options, data, $block);

                $block.prependTo($stash);
                methods.fadeEffect(options, $block);
            }
        },

        //$cell can also be a stash, same idea
        allowBlock:  function ($block, $cell) {
            var blockType = $block.data('bd-type');
            var cellAccept = $cell.data('bd-accept');
            var cellDeny = $cell.data('bd-deny');

            if (cellAccept && cellDeny) {
                $.error("Cell has both bd-accept and bd-deny");
                return false;
            }

            if (cellAccept) {
                //does the cell even have a type?
                if (!blockType) {
                    return false;
                }

                var acceptTypes = cellAccept.split(',');
                if (acceptTypes.indexOf(blockType) > -1) {
                    return true;
                }
            }

            if (cellDeny) {
                //does the cell even have a type? if not, it's probably ok
                if (!blockType) {
                    return true;
                }

                var denyTypes = cellDeny.split(',');
                if (denyTypes.indexOf(blockType) > -1) {
                    return false;
                } else {
                    return true;
                }
            }

            //no deny nor return: It's kay.
            return true;

        },

        findStash: function ($el, options, data, $block) {
            var $stash = null;

            //find all stashes and loop through them. If more then one matches we have a problem
            $el.find("*[data-bd-stash]").each(function () {
                if (methods.allowBlock($block, $(this))) {
                    if (!$stash) {
                        $stash = $(this);
                    } else {
                        $.error("More then one stash matches for this block. Go fix it.");
                    }
                }
            });


            if (!$stash) {
                $.error("No matching stash found for block.");
            }
            return $stash;
        },

        extractData: function ($el, options, data) {
            //loop through the cells, see what blocks they hold, and add this to the result
            var result = {};

            $el.find("*[data-bd-grid] *[data-bd-cell-id]").each(function () {
                var $cell = $(this);
                var $block = $cell.find("*[data-bd-block-id]");
                result[$cell.data('bd-cell-id')] = $block ? $block.data('bd-block-id') : null;
            });

            return result;
        },

        fadeEffect: function (options, $block) {
            if (options.fadeEffect) {
                $block.fadeTo(0, 0).fadeTo(500, 1);
            }
        }
    }

    $.fn.blokkendoos = function () {
        var args = arguments;

        //return $(this).each(function () {
        var $el = $(this);
        var options = $el.data('bd-options');
        var data = $el.data('bd-data');

        if (!options) {
            if (args[0].clone === true) {
                $.error("Blokkendoos is currently completely borked when clone = true. Please turn it off or whack Nick across the jaw with a leg of goat.");
            }
            methods.init($(this), args[0]);
            return $el;
        }

        //calling custom functions
        if (args[0] == 'data') {
            return methods.extractData($el, options, data);
        }

        //});
    }

})(jQuery);