/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import {
	__experimentalToolsPanel as ToolsPanel,
	__experimentalToolsPanelItem as ToolsPanelItem,
	__experimentalBoxControl as BoxControl,
	__experimentalUseCustomUnits as useCustomUnits,
	__experimentalUnitControl as UnitControl,
} from '@wordpress/components';
import { __experimentalUseCustomSides as useCustomSides } from '@wordpress/block-editor';

/**
 * Internal dependencies
 */
import { useSetting } from '../editor/utils';

const AXIAL_SIDES = [ 'horizontal', 'vertical' ];

export function useHasDimensionsPanel( context ) {
	const hasHeight = useHasHeight( context );
	const hasWidth = useHasWidth( context );
	const hasPadding = useHasPadding( context );
	const hasMargin = useHasMargin( context );

	return hasHeight || hasWidth || hasPadding || hasMargin;
}

function useHasHeight( { name, supports } ) {
	const settings = useSetting( 'dimensions.customHeight', name );

	return settings && supports.includes( 'height' );
}

function useHasWidth( { name, supports } ) {
	const settings = useSetting( 'dimensions.customWidth', name );

	return settings && supports.includes( 'width' );
}

function useHasPadding( { name, supports } ) {
	const settings = useSetting( 'spacing.customPadding', name );

	return settings && supports.includes( 'padding' );
}

function useHasMargin( { name, supports } ) {
	const settings = useSetting( 'spacing.customMargin', name );

	return settings && supports.includes( 'margin' );
}

function filterValuesBySides( values, sides ) {
	if ( ! sides ) {
		// If no custom side configuration all sides are opted into by default.
		return values;
	}

	// Only include sides opted into within filtered values.
	const filteredValues = {};
	sides.forEach( ( side ) => {
		if ( side === 'vertical' ) {
			filteredValues.top = values.top;
			filteredValues.bottom = values.bottom;
		}
		if ( side === 'horizontal' ) {
			filteredValues.left = values.left;
			filteredValues.right = values.right;
		}
		filteredValues[ side ] = values[ side ];
	} );

	return filteredValues;
}

function splitStyleValue( value ) {
	// Check for shorthand value ( a string value ).
	if ( value && typeof value === 'string' ) {
		// Convert to value for individual sides for BoxControl.
		return {
			top: value,
			right: value,
			bottom: value,
			left: value,
		};
	}

	return value;
}

export default function DimensionsPanel( { context, getStyle, setStyle } ) {
	const { name } = context;
	const showHeightControl = useHasHeight( context );
	const showWidthControl = useHasWidth( context );
	const showPaddingControl = useHasPadding( context );
	const showMarginControl = useHasMargin( context );
	const units = useCustomUnits( {
		availableUnits: useSetting( 'spacing.units', name ) || [
			'%',
			'px',
			'em',
			'rem',
			'vh',
			'vw',
		],
	} );

	// Height.
	const heightValue = getStyle( name, 'height' );
	const setHeightValue = ( next ) => setStyle( name, 'height', next );
	const resetHeightValue = () => setHeightValue( undefined );
	const hasHeightValue = () => !! heightValue;

	// Width.
	const widthValue = getStyle( name, 'width' );
	const setWidthValue = ( next ) => setStyle( name, 'width', next );
	const resetWidthValue = () => setWidthValue( undefined );
	const hasWidthValue = () => !! widthValue;

	// Padding.
	const paddingValues = splitStyleValue( getStyle( name, 'padding' ) );
	const paddingSides = useCustomSides( name, 'padding' );
	const isAxialPadding =
		paddingSides &&
		paddingSides.some( ( side ) => AXIAL_SIDES.includes( side ) );

	const setPaddingValues = ( newPaddingValues ) => {
		const padding = filterValuesBySides( newPaddingValues, paddingSides );
		setStyle( name, 'padding', padding );
	};
	const resetPaddingValue = () => setPaddingValues( {} );
	const hasPaddingValue = () =>
		paddingValues && Object.keys( paddingValues ).length;

	// Margin.
	const marginValues = splitStyleValue( getStyle( name, 'margin' ) );
	const marginSides = useCustomSides( name, 'margin' );
	const isAxialMargin =
		marginSides &&
		marginSides.some( ( side ) => AXIAL_SIDES.includes( side ) );

	const setMarginValues = ( newMarginValues ) => {
		const margin = filterValuesBySides( newMarginValues, marginSides );
		setStyle( name, 'margin', margin );
	};
	const resetMarginValue = () => setMarginValues( {} );
	const hasMarginValue = () =>
		marginValues && Object.keys( marginValues ).length;

	const resetAll = () => {
		resetHeightValue();
		resetWidthValue();
		resetPaddingValue();
		resetMarginValue();
	};

	return (
		<ToolsPanel
			label={ __( 'Dimensions options' ) }
			header={ __( 'Dimensions' ) }
			resetAll={ resetAll }
		>
			{ showHeightControl && (
				<ToolsPanelItem
					className="single-column"
					hasValue={ hasHeightValue }
					label={ __( 'Height' ) }
					onDeselect={ resetHeightValue }
					isShownByDefault={ true }
				>
					<UnitControl
						label={ __( 'Height' ) }
						value={ heightValue }
						onChange={ setHeightValue }
						units={ units }
						min={ 0 }
					/>
				</ToolsPanelItem>
			) }
			{ showWidthControl && (
				<ToolsPanelItem
					className="single-column"
					hasValue={ hasWidthValue }
					label={ __( 'Width' ) }
					onDeselect={ resetWidthValue }
					isShownByDefault={ true }
				>
					<UnitControl
						label={ __( 'Width' ) }
						value={ widthValue }
						onChange={ setWidthValue }
						units={ units }
						min={ 0 }
					/>
				</ToolsPanelItem>
			) }
			{ showPaddingControl && (
				<ToolsPanelItem
					hasValue={ hasPaddingValue }
					label={ __( 'Padding' ) }
					onDeselect={ resetPaddingValue }
					isShownByDefault={ true }
				>
					<BoxControl
						values={ paddingValues }
						onChange={ setPaddingValues }
						label={ __( 'Padding' ) }
						sides={ paddingSides }
						units={ units }
						allowReset={ false }
						splitOnAxis={ isAxialPadding }
					/>
				</ToolsPanelItem>
			) }
			{ showMarginControl && (
				<ToolsPanelItem
					hasValue={ hasMarginValue }
					label={ __( 'Margin' ) }
					onDeselect={ resetMarginValue }
					isShownByDefault={ true }
				>
					<BoxControl
						values={ marginValues }
						onChange={ setMarginValues }
						label={ __( 'Margin' ) }
						sides={ marginSides }
						units={ units }
						allowReset={ false }
						splitOnAxis={ isAxialMargin }
					/>
				</ToolsPanelItem>
			) }
		</ToolsPanel>
	);
}
