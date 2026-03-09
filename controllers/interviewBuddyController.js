const category  = require('../models/categories');

const addCategoryForAIBuddy = async (req, res) => {
try {
    const { mainCategory } = req.body;
    console.log("Adding category for AI Buddy:", mainCategory);

    const existingCategory = await category.findOne({ name: mainCategory, parentId: null });
    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'Category already exists. Please choose a different name.'
      });
    }

    const newCategory = new category({
      name: mainCategory,
      parentId: null
    });
    
    await newCategory.save();
    return res.status(201).json({
      success: true,
      message: 'Category added successfully for AI Buddy',
      category: newCategory
    });
    
  } catch (error) {
    console.error("Error adding category for AI Buddy:", error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}


const deleteCategoryForAIBuddy = async (req, res) => {
  try {
    const { categoryId } = req.body;
    console.log("Deleting category for AI Buddy:", categoryId);

    const categoryToDelete = await category.findById(categoryId);
    if (!categoryToDelete) {
      return res.status(404).json({
        success: false,
        message: 'Category not found. Please provide a valid category ID.'
      });
    }

    await category.deleteOne({ _id: categoryId });

    return res.status(200).json({
      success: true,
      message: 'Category deleted successfully for AI Buddy'
    });
    
  } catch (error) {
    console.error("Error deleting category for AI Buddy:", error);
     return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}


const addSubCategoryForAIBuddy = async (req, res) => {
  try {
    const { categoryId, subCategory } = req.body;
    console.log("Adding subcategory for AI Buddy:", categoryId, subCategory);

    const parentCategory = await category.findById(categoryId);
    if (!parentCategory) {
      return res.status(404).json({
        success: false,
        message: 'Main category not found. Please provide a valid main category ID.'
      });
    }

    const existingSubCategory = await category.findOne({ name: subCategory, parentId: categoryId });
    if (existingSubCategory) {
      return res.status(400).json({
        success: false,
        message: 'Subcategory already exists under this main category. Please choose a different name.'
      });
    }

    const newSubCategory = new category({
      name: subCategory,
      parentId: categoryId
    });
    
    await newSubCategory.save();
    return res.status(201).json({
      success: true,
      message: 'Subcategory added successfully for AI Buddy',
      subCategory: newSubCategory
    });
    
  } catch (error) {
    console.error("Error adding subcategory for AI Buddy:", error);
     return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}

const deleteSubCategoryForAIBuddy = async (req, res) => {
    try {
    const {categoryId, subCategory} = req.body;
    console.log("Deleting subcategory for AI Buddy:", categoryId, subCategory);

    const parentCategory = await category.findById(categoryId);
    if (!parentCategory) {
      return res.status(404).json({
        success: false,
        message: 'Main category not found. Please provide a valid main category ID.'
      });
    }

    const subCategoryToDelete = await category.findOne({ name: subCategory, parentId: categoryId });
    if (!subCategoryToDelete) {
      return res.status(404).json({
        success: false,
        message: 'Subcategory not found under this main category. Please provide a valid subcategory name.'
      });
    }

    await category.deleteOne({ _id: subCategoryToDelete._id });

    return res.status(200).json({
      success: true,
      message: 'Subcategory deleted successfully for AI Buddy'
    });
    } catch (error) {
    console.error("Error deleting subcategory for AI Buddy:", error);
     return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}

module.exports = {
  addCategoryForAIBuddy,
  deleteCategoryForAIBuddy,
  addSubCategoryForAIBuddy,
  deleteSubCategoryForAIBuddy
}