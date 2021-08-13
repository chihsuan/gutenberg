/**
 * External dependencies
 */
import { clone } from 'lodash';

/**
 * WordPress dependencies
 */

import { useMergeRefs, useReducedMotion } from '@wordpress/compose';
import { __experimentalTreeGrid as TreeGrid } from '@wordpress/components';
import { useDispatch } from '@wordpress/data';
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useReducer,
	useState,
} from '@wordpress/element';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import ListViewBranch from './branch';
import { ListViewContext } from './context';
import useListViewClientIds from './use-list-view-client-ids';
import { store as blockEditorStore } from '../../store';

const noop = () => {};
const expanded = ( state, action ) => {
	switch ( action.type ) {
		case 'expand':
			return { ...state, ...{ [ action.clientId ]: true } };
		case 'collapse':
			return { ...state, ...{ [ action.clientId ]: false } };
		default:
			return state;
	}
};

function removeItemFromTree( tree, id, parentId = '' ) {
	const newTree = [];
	let removeParentId = '';
	for ( let index = 0; index < tree.length; index++ ) {
		const block = tree[ index ];
		if ( block.clientId !== id ) {
			if ( block.innerBlocks.length > 0 ) {
				const {
					newTree: innerBlocks,
					removeParentId: cRemoveParentId,
				} = removeItemFromTree( block.innerBlocks, id, block.clientId );
				newTree.push( {
					...block,
					innerBlocks,
				} );
				removeParentId =
					cRemoveParentId !== '' ? cRemoveParentId : removeParentId;
			} else {
				newTree.push( { ...block } );
			}
		} else {
			removeParentId = parentId;
		}
	}
	return { newTree, removeParentId };
}

function addItemToTree( tree, id, item, insertAfter = true, parentId = '' ) {
	const newTree = [];
	let targetIndex = -1;
	let targetId = '';
	for ( let index = 0; index < tree.length; index++ ) {
		const block = tree[ index ];
		if ( block.clientId === id ) {
			targetId = parentId;
			if ( insertAfter ) {
				targetIndex = newTree.length + 1;
				newTree.push( { ...block } );
				newTree.push( { ...item } );
			} else {
				targetIndex = newTree.length;
				newTree.push( { ...item } );
				newTree.push( { ...block } );
			}
		} else if ( block.clientId !== id ) {
			if ( block.innerBlocks.length > 0 ) {
				const {
					newTree: innerBlocks,
					targetIndex: childTargetIndex,
					targetId: childTargetId,
				} = addItemToTree(
					block.innerBlocks,
					id,
					item,
					insertAfter,
					block.clientId
				);
				newTree.push( {
					...block,
					innerBlocks,
				} );
				targetIndex = Math.max( targetIndex, childTargetIndex );
				targetId = childTargetId !== '' ? childTargetId : targetId;
			} else {
				newTree.push( { ...block } );
			}
		}
	}
	return { newTree, targetId, targetIndex };
}

const UP = 'up';
const DOWN = 'down';

// eslint-disable-next-line no-unused-vars
function findFirstValidPosition( positions, current, translate, moveDown ) {
	//TODO: add this back when implementing skipping over invalid items
	const ITEM_HEIGHT = 36;
	const iterate = moveDown ? 1 : -1;
	let index = current + iterate;
	let diff = Math.abs( translate );
	while ( positions[ index ] !== undefined && diff > ITEM_HEIGHT / 2 ) {
		const position = positions[ index ];
		if ( position.dropContainer || position.dropSibling ) {
			return position;
		}
		index += iterate;
		diff = diff - ITEM_HEIGHT;
	}
}

/**
 * Wrap `ListViewRows` with `TreeGrid`. ListViewRows is a
 * recursive component (it renders itself), so this ensures TreeGrid is only
 * present at the very top of the navigation grid.
 *
 * @param {Object}   props                                          Components props.
 * @param {Array}    props.blocks                                   Custom subset of block client IDs to be used
 *                                                                  instead of the default hierarchy.
 * @param {Function} props.onSelect                                 Block selection callback.
 * @param {boolean}  props.showNestedBlocks                         Flag to enable displaying nested blocks.
 * @param {boolean}  props.showOnlyCurrentHierarchy                 Flag to limit the list to the current hierarchy of
 *                                                                  blocks.
 * @param {boolean}  props.__experimentalFeatures                   Flag to enable experimental features.
 * @param {boolean}  props.__experimentalPersistentListViewFeatures Flag to enable features for the Persistent List
 *                                                                  View experiment.
 */
export default function ListView( {
	blocks,
	showOnlyCurrentHierarchy,
	onSelect = noop,
	__experimentalFeatures,
	__experimentalPersistentListViewFeatures,
	...props
} ) {
	const [ draggingId, setDraggingId ] = useState( false );
	const [ dropped, setDropped ] = useState( false );
	const { clientIdsTree, selectedClientIds } = useListViewClientIds(
		blocks,
		showOnlyCurrentHierarchy,
		__experimentalPersistentListViewFeatures,
		draggingId
	);
	const [ tree, setTree ] = useState( clientIdsTree );
	const { selectBlock, moveBlocksToPosition } = useDispatch(
		blockEditorStore
	);
	const selectEditorBlock = useCallback(
		( clientId ) => {
			selectBlock( clientId );
			onSelect( clientId );
		},
		[ selectBlock, onSelect ]
	);
	const [ expandedState, setExpandedState ] = useReducer( expanded, {} );

	const elementRef = useRef();
	const timeoutRef = useRef();
	const treeGridRef = useMergeRefs( [ elementRef, timeoutRef ] );

	const isMounted = useRef( false );
	useEffect( () => {
		isMounted.current = true;
	}, [] );

	const expand = ( clientId ) => {
		if ( ! clientId ) {
			return;
		}
		setExpandedState( { type: 'expand', clientId } );
	};
	const collapse = ( clientId ) => {
		if ( ! clientId ) {
			return;
		}
		setExpandedState( { type: 'collapse', clientId } );
	};
	const expandRow = ( row ) => {
		expand( row?.dataset?.block );
	};
	const collapseRow = ( row ) => {
		collapse( row?.dataset?.block );
	};

	const animate = ! useReducedMotion();

	const positionsRef = useRef( {} );
	const positions = positionsRef.current;
	const setPosition = ( clientId, offset ) =>
		( positions[ clientId ] = offset );

	const lastTarget = useRef( null );
	useEffect( () => {
		lastTarget.current = null;
	}, [] );

	const dropItem = async () => {
		if ( ! lastTarget.current ) {
			return;
		}
		setDropped( true );
		const {
			clientId,
			originalParent,
			targetId,
			targetIndex,
		} = lastTarget.current;
		lastTarget.current = null;
		await moveBlocksToPosition(
			[ clientId ],
			originalParent,
			targetId,
			targetIndex
		);
		//TODO: still need to find something more reliable to test if things have settled
		timeoutRef.current = setTimeout( () => {
			setDropped( false );
		}, 200 );
	};

	const moveItem = ( {
		block,
		translate,
		listPosition,
		isLastChild,
		isFirstChild,
		velocity,
	} ) => {
		//TODO: support add to container
		//TODO: support add to child container
		//TODO: simplify state and code
		//TODO: either constrain the drag area to the max number of items, or test if we're hovering over the midpoint of next targets
		const { clientId } = block;
		const ITEM_HEIGHT = 36;

		const v = velocity?.get() ?? 0;
		if ( v === 0 ) {
			return;
		}

		const direction = v > 0 ? DOWN : UP;

		if ( Math.abs( translate ) > ITEM_HEIGHT / 2 ) {
			const position = positions[ listPosition ];

			// First, check to see if we should break out of a container block:
			if (
				position.parentId &&
				( ( direction === UP && isFirstChild ) ||
					( direction === DOWN && isLastChild ) )
			) {
				const {
					newTree: treeWithoutDragItem,
					removeParentId,
				} = removeItemFromTree( clientIdsTree, clientId );
				const { newTree, targetId, targetIndex } = addItemToTree(
					treeWithoutDragItem,
					position.parentId,
					block,
					direction === DOWN
				);
				lastTarget.current = {
					clientId,
					originalParent: removeParentId,
					targetId,
					targetIndex,
				};
				setTree( newTree );
				return;
			}

			// Swap siblings
			const targetPosition =
				direction === DOWN
					? positions[ listPosition + 1 ]
					: positions[ listPosition - 1 ];

			if ( targetPosition === undefined ) {
				return;
			}
			if ( position.parentId === targetPosition.parentId ) {
				//Sibling swap
				const {
					newTree: treeWithoutDragItem,
					removeParentId,
				} = removeItemFromTree( clientIdsTree, clientId );
				const { newTree, targetIndex, targetId } = addItemToTree(
					treeWithoutDragItem,
					targetPosition.clientId,
					block,
					direction === DOWN
				);
				lastTarget.current = {
					clientId,
					originalParent: removeParentId,
					targetId,
					targetIndex,
				};
				setTree( newTree );
			}
		}
	};

	const contextValue = useMemo(
		() => ( {
			__experimentalFeatures,
			__experimentalPersistentListViewFeatures,
			isTreeGridMounted: isMounted.current,
			expandedState,
			expand,
			collapse,
			animate,
			draggingId,
			setDraggingId,
		} ),
		[
			__experimentalFeatures,
			__experimentalPersistentListViewFeatures,
			isMounted.current,
			expandedState,
			expand,
			collapse,
			animate,
			draggingId,
			setDraggingId,
		]
	);

	//TODO: mouseover on items highlights blocks and triggers a render check on all branches
	//TODO: used in prototyping, polish this more
	useEffect( () => {
		if ( draggingId ) {
			setTree( clone( clientIdsTree ) );
		}
	}, [ draggingId ] );

	useEffect( () => {
		if ( timeoutRef.current ) {
			clearTimeout( timeoutRef.current );
		}
	}, [] );

	return (
		<>
			<TreeGrid
				className="block-editor-list-view-tree"
				aria-label={ __( 'Block navigation structure' ) }
				ref={ treeGridRef }
				onCollapseRow={ collapseRow }
				onExpandRow={ expandRow }
				animate={ animate }
			>
				<ListViewContext.Provider value={ contextValue }>
					<ListViewBranch
						blocks={ draggingId || dropped ? tree : clientIdsTree }
						selectBlock={ selectEditorBlock }
						selectedBlockClientIds={ selectedClientIds }
						setPosition={ setPosition }
						moveItem={ moveItem }
						dropItem={ dropItem }
						{ ...props }
					/>
				</ListViewContext.Provider>
			</TreeGrid>
		</>
	);
}
