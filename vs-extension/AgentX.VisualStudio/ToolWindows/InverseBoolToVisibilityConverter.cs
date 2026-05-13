using System;
using System.Globalization;
using System.Windows;
using System.Windows.Data;

namespace AgentX.VisualStudio.ToolWindows;

/// <summary>
/// Returns <see cref="Visibility.Collapsed"/> for <c>true</c> and <see cref="Visibility.Visible"/>
/// for <c>false</c> or <c>null</c>. Used to flip Status-tab fallback TextBoxes off when the
/// structured WPF lists become available.
/// </summary>
internal sealed class InverseBoolToVisibilityConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        var flag = value is bool b && b;
        return flag ? Visibility.Collapsed : Visibility.Visible;
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
    {
        return value is Visibility v && v == Visibility.Collapsed;
    }
}
